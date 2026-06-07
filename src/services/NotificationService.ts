import { EmbedBuilder } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { client } from '../bot/client';
import { Colors } from '../types/index';
import { logger } from '../utils/logger';
import { getLocale } from '../locales';

const prisma = new PrismaClient();

export class NotificationService {
  static async dmUser(userId: string, embed: EmbedBuilder): Promise<boolean> {
    try {
      const user = await client.users.fetch(userId);
      await user.send({ embeds: [embed] });
      return true;
    } catch {
      return false;
    }
  }

  static async notifyTicketClosed(ticketId: string): Promise<void> {
    try {
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) return;

      const t = getLocale((ticket as any).language);
      const guildName = client.guilds.cache.get(ticket.guildId)?.name ?? '';

      const embed = new EmbedBuilder()
        .setColor(Colors.NEUTRAL)
        .setTitle(t.notification.closedTitle)
        .setDescription(
          t.notification.closedDescription(
            ticket.ticketNumber,
            ticket.type.replace(/_/g, ' '),
            ticket.closedReason ?? t.notification.noReason,
            guildName,
          )
        )
        .setTimestamp();

      await this.dmUser(ticket.creatorId, embed);
    } catch (err) {
      logger.error('notifyTicketClosed error', err);
    }
  }

  static async notifyTransactionUpdate(transactionId: string): Promise<void> {
    try {
      const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
      if (!tx) return;

      // Transactions default to English — no per-transaction language yet
      const t = getLocale('en');

      const embed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle(t.notification.transactionTitle)
        .setDescription(
          t.notification.transactionDescription(
            tx.humanId,
            tx.status.replace(/_/g, ' '),
            tx.item,
          )
        )
        .setTimestamp();

      await Promise.all([
        this.dmUser(tx.buyerId, embed),
        this.dmUser(tx.sellerId, embed),
      ]);
    } catch (err) {
      logger.error('notifyTransactionUpdate error', err);
    }
  }
}
