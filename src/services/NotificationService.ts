import { EmbedBuilder } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { client } from '../bot/client';
import { Colors } from '../types/index';
import { logger } from '../utils/logger';

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

      const embed = new EmbedBuilder()
        .setColor(Colors.NEUTRAL)
        .setTitle('🔒 Your ticket has been closed')
        .setDescription(
          `**Ticket:** #${ticket.ticketNumber} — ${ticket.type.replace(/_/g, ' ')}\n` +
          `**Reason:** ${ticket.closedReason ?? 'No reason provided'}\n\n` +
          `If you need further help, open a new ticket in **${client.guilds.cache.get(ticket.guildId)?.name}**.`
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

      const embed = new EmbedBuilder()
        .setColor(Colors.INFO)
        .setTitle('💳 Transaction Update')
        .setDescription(
          `**Ref:** \`${tx.humanId}\`\n` +
          `**Status:** ${tx.status.replace(/_/g, ' ')}\n` +
          `**Item:** ${tx.item}`
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
