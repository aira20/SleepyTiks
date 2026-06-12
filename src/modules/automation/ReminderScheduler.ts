// AUTOMATION NOT FOR NOW, PREMIUM JUGA BELUM TENTU KELUAR, MOSTLY ALL THE NEEDED FEATURES ARE IN FREEMIUM 

import { PrismaClient } from '@prisma/client';
import { TextChannel, EmbedBuilder } from 'discord.js';
import { client } from '../../bot/client';
import { Colors } from '../../types/index';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

export class ReminderScheduler {
  /**
   * Send a reminder ping for tickets waiting on staff response > 2 hours.
   * Premium only.
   */
  static async sendStaffReminders(): Promise<void> {
    try {
      const threshold = new Date(Date.now() - 2 * 60 * 60 * 1000);

      const premiumGuilds = await prisma.guild.findMany({
        where: { premiumTier: { not: 'NONE' } },
        select: { id: true, staffRoleIds: true },
      });
      if (premiumGuilds.length === 0) return;

      const guildMap = new Map(premiumGuilds.map(g => [g.id, g]));

      const waitingTickets = await prisma.ticket.findMany({
        where: {
          status: { in: ['OPEN', 'WAITING_STAFF'] },
          updatedAt: { lt: threshold },
          guildId: { in: premiumGuilds.map(g => g.id) },
        },
      });

      for (const ticket of waitingTickets) {
        const channel = client.channels.cache.get(ticket.channelId) as TextChannel | undefined;
        if (!channel) continue;

        const embed = new EmbedBuilder()
          .setColor(Colors.WARNING)
          .setDescription(`â° This ticket has been waiting for a staff response for over 2 hours. Please attend to it soon.`);

        const guildConfig = guildMap.get(ticket.guildId);
        const ping = guildConfig?.staffRoleIds[0] ? `<@&${guildConfig.staffRoleIds[0]}>` : '';
        await channel.send({ content: ping, embeds: [embed] }).catch(() => {});

        // Touch updatedAt to avoid repeat pings within the threshold window
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { updatedAt: new Date() },
        });
      }
    } catch (err) {
      logger.error('ReminderScheduler.sendStaffReminders error', err);
    }
  }
}
