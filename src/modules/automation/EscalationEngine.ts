import { PrismaClient } from '@prisma/client';
import { TextChannel } from 'discord.js';
import { client } from '../../bot/client';
import { TicketManager } from '../tickets/TicketManager';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

export class EscalationEngine {
  /**
   * Scan for tickets that have been idle too long and escalate them.
   * Runs on a cron schedule (see index.ts).
   */
  static async runEscalationScan(): Promise<void> {
    try {
      const guilds = await prisma.guild.findMany({
        where: { premiumTier: { not: 'NONE' } },
      });

      for (const guild of guilds) {
        const thresholdHours = 4;
        const threshold = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);

        const staleTickets = await prisma.ticket.findMany({
          where: {
            guildId: guild.id,
            status: { in: ['OPEN', 'CLAIMED', 'WAITING_STAFF'] },
            updatedAt: { lt: threshold },
            priority: { notIn: ['URGENT', 'CRITICAL'] },
          },
        });

        for (const ticket of staleTickets) {
          await TicketManager.escalate({
            ticketId: ticket.id,
            escalatedById: client.user!.id,
            escalatedByTag: client.user!.tag,
            reason: `Auto-escalated: no activity for ${thresholdHours}+ hours`,
            newPriority: 'HIGH',
          });

          const channel = client.channels.cache.get(ticket.channelId) as TextChannel | undefined;
          if (channel) {
            const staffMention = guild.staffRoleIds[0] ? `<@&${guild.staffRoleIds[0]}>` : '';
            await channel.send({
              content: staffMention,
              embeds: [{
                color: 0xed4245,
                description: `âš ï¸ This ticket has been **auto-escalated** due to ${thresholdHours}+ hours of inactivity.`,
              }] as any,
            });
          }
        }
      }
    } catch (err) {
      logger.error('EscalationEngine.runEscalationScan error', err);
    }
  }

  /**
   * Auto-close tickets that have been idle past guild.autoCloseInactiveDays
   */
  static async runAutoCloseScan(): Promise<void> {
    try {
      const guilds = await prisma.guild.findMany({
        where: { premiumTier: { not: 'NONE' } },
      });

      for (const guild of guilds) {
        if (!guild.autoCloseInactiveDays || guild.autoCloseInactiveDays <= 0) continue;
        const threshold = new Date(Date.now() - guild.autoCloseInactiveDays * 24 * 60 * 60 * 1000);

        const idleTickets = await prisma.ticket.findMany({
          where: {
            guildId: guild.id,
            status: 'WAITING_USER',
            updatedAt: { lt: threshold },
          },
        });

        for (const ticket of idleTickets) {
          await TicketManager.close({
            ticketId: ticket.id,
            closedById: client.user!.id,
            closedByTag: client.user!.tag,
            reason: `Auto-closed: no user response after ${guild.autoCloseInactiveDays} days`,
            generateTranscript: true,
          });
        }
      }
    } catch (err) {
      logger.error('EscalationEngine.runAutoCloseScan error', err);
    }
  }
}
