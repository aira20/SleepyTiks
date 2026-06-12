import { PrismaClient, TransactionStatus } from '@prisma/client';
import type { ChatInputCommandInteraction } from 'discord.js';
import { TransactionCreateOptions, TransactionStatusUpdate } from '../../types/index';
import { NotificationService } from '../../services/NotificationService';
import { generateTransactionRef } from '../../utils/formatting';
import { successEmbed } from '../../components/embeds/success';
import { errorEmbed } from '../../components/embeds/error';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

interface SimpleCreateOptions {
  guildId: string;
  initiatorId: string;
  buyerId: string;
  sellerId: string;
  item: string;
  amount: number;
  currency: string;
  description?: string;
  paymentMethod?: string;
}

export class MiddlemanManager {
  // ── Bikin transaksi baru, sekalian generate humanId-nya
  static async createTransaction(options: TransactionCreateOptions) {
    const {
      guildId, buyerId, buyerTag, sellerId, sellerTag,
      item, description, price, currency, paymentMethod, notes,
    } = options;

    const count = await prisma.transaction.count({ where: { guildId } });
    const humanId = generateTransactionRef(count + 1);

    const transaction = await prisma.transaction.create({
      data: {
        guildId,
        humanId,
        buyerId,
        buyerTag,
        sellerId,
        sellerTag,
        item,
        description,
        price,
        currency,
        paymentMethod,
        notes,
        status: 'PENDING',
      },
    });

    logger.info(`Transaction created: ${humanId}`);
    return transaction;
  }

  // ── Update status transaksi + history-nya, dicek dulu transition-nya valid gak
  static async updateStatus(options: TransactionStatusUpdate) {
    const { transactionId, newStatus, updatedById, updatedByTag, note, proofUrl } = options;

    const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!tx) throw new Error('Transaction not found');

    this.validateTransition(tx.status, newStatus);

    const updateData: any = { status: newStatus, updatedAt: new Date() };
    if (newStatus === 'COMPLETED') updateData.completedAt = new Date();
    if (newStatus === 'DISPUTED') updateData.disputedAt = new Date();
    if (newStatus === 'CANCELLED') updateData.cancelledAt = new Date();
    if (proofUrl) {
      if (newStatus === 'PAYMENT_CONFIRMED') updateData.paymentProofUrl = proofUrl;
      if (newStatus === 'COMPLETED') updateData.deliveryProofUrl = proofUrl;
    }

    await prisma.transaction.update({ where: { id: transactionId }, data: updateData });

    await prisma.transactionStatusHistory.create({
      data: {
        transactionId,
        changedById: updatedById,
        changedByTag: updatedByTag,
        fromStatus: tx.status,
        toStatus: newStatus,
        note,
      },
    });

    await NotificationService.notifyTransactionUpdate(transactionId);

    return prisma.transaction.findUnique({ where: { id: transactionId } });
  }

  static async assignMiddleman(transactionId: string, middlemanId: string, middlemanTag: string) {
    return prisma.transaction.update({
      where: { id: transactionId },
      data: { middlemanId, middlemanTag, status: 'WAITING_PAYMENT' },
    });
  }

  static async getByRef(humanId: string) {
    return prisma.transaction.findUnique({
      where: { humanId },
      include: { statusHistory: { orderBy: { createdAt: 'asc' } } },
    });
  }

  static async getUserTransactions(guildId: string, userId: string) {
    return prisma.transaction.findMany({
      where: {
        guildId,
        OR: [{ buyerId: userId }, { sellerId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  private static validateTransition(current: TransactionStatus, next: TransactionStatus) {
    const allowed: Partial<Record<TransactionStatus, TransactionStatus[]>> = {
      PENDING:              ['WAITING_PAYMENT', 'CANCELLED'],
      WAITING_PAYMENT:      ['PAYMENT_CONFIRMED', 'DISPUTED', 'CANCELLED'],
      PAYMENT_CONFIRMED:    ['DELIVERY_IN_PROGRESS', 'DISPUTED', 'CANCELLED'],
      DELIVERY_IN_PROGRESS: ['COMPLETED', 'DISPUTED'],
      DISPUTED:             ['COMPLETED', 'REFUNDED', 'CANCELLED'],
      COMPLETED:            [],
      CANCELLED:            [],
      REFUNDED:             [],
    };

    if (!allowed[current]?.includes(next)) {
      throw new Error(`Invalid transition: ${current} -> ${next}`);
    }
  }

  // ── Helpers buat dipanggil langsung dari slash command
  async createTransaction(opts: SimpleCreateOptions, interaction: ChatInputCommandInteraction) {
    try {
      const buyer  = await interaction.client.users.fetch(opts.buyerId);
      const seller = await interaction.client.users.fetch(opts.sellerId);

      const tx = await MiddlemanManager.createTransaction({
        guildId: opts.guildId,
        buyerId: opts.buyerId,
        buyerTag: buyer.tag,
        sellerId: opts.sellerId,
        sellerTag: seller.tag,
        item: opts.item,
        description: opts.description,
        price: opts.amount as any,
        currency: opts.currency,
        paymentMethod: opts.paymentMethod ?? 'TBD',
        notes: undefined,
      });

      return interaction.reply({
        embeds: [successEmbed(
          `Transaction **${tx.humanId}** created.\n` +
          `Buyer: <@${opts.buyerId}> Â· Seller: <@${opts.sellerId}>\n` +
          `Item: ${opts.item}\n` +
          `Amount: ${opts.amount} ${opts.currency}`,
        )],
        ephemeral: false,
      });
    } catch (err) {
      logger.error('createTransaction error', err);
      const message = err instanceof Error ? err.message : 'Failed to create transaction.';
      return interaction.reply({ embeds: [errorEmbed(message)], ephemeral: true });
    }
  }

  async cancelTransaction(
    transactionId: string,
    actorId: string,
    actorTag: string,
    reason: string,
    interaction: ChatInputCommandInteraction,
  ) {
    return this.transitionAndReply(
      transactionId, 'CANCELLED', actorId, actorTag, reason,
      `Transaction cancelled.\nReason: ${reason}`, interaction,
    );
  }

  async confirmPayment(
    transactionId: string,
    actorId: string,
    actorTag: string,
    interaction: ChatInputCommandInteraction,
  ) {
    return this.transitionAndReply(
      transactionId, 'PAYMENT_CONFIRMED', actorId, actorTag, 'Buyer confirmed payment',
      'Payment confirmed. Seller may now deliver.', interaction,
    );
  }

  async confirmDelivery(
    transactionId: string,
    actorId: string,
    actorTag: string,
    interaction: ChatInputCommandInteraction,
  ) {
    return this.transitionAndReply(
      transactionId, 'COMPLETED', actorId, actorTag, 'Buyer confirmed delivery',
      'Delivery confirmed. Transaction completed.', interaction,
    );
  }

  async openDispute(
    transactionId: string,
    actorId: string,
    actorTag: string,
    reason: string,
    interaction: ChatInputCommandInteraction,
  ) {
    try {
      await MiddlemanManager.updateStatus({
        transactionId,
        newStatus: 'DISPUTED',
        updatedById: actorId,
        updatedByTag: actorTag,
        note: reason,
      });
      await prisma.transaction.update({
        where: { id: transactionId },
        data: { disputeReason: reason, disputeOpenedById: actorId },
      });
      return interaction.reply({
        embeds: [successEmbed(`Dispute opened.\nReason: ${reason}`)],
        ephemeral: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open dispute.';
      return interaction.reply({ embeds: [errorEmbed(message)], ephemeral: true });
    }
  }

  private async transitionAndReply(
    transactionId: string,
    newStatus: TransactionStatus,
    actorId: string,
    actorTag: string,
    note: string,
    successMessage: string,
    interaction: ChatInputCommandInteraction,
  ) {
    try {
      await MiddlemanManager.updateStatus({
        transactionId,
        newStatus,
        updatedById: actorId,
        updatedByTag: actorTag,
        note,
      });
      return interaction.reply({ embeds: [successEmbed(successMessage)], ephemeral: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update transaction.';
      return interaction.reply({ embeds: [errorEmbed(message)], ephemeral: true });
    }
  }
}
