import { TextChannel, EmbedBuilder } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { client } from '../bot/client';
import { Colors } from '../types/index';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface AuditEntry {
  guildId: string;
  ticketId?: string;
  actorId: string;
  actorTag: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
}

export class AuditService {
  static async log(entry: AuditEntry): Promise<void> {
    try {
      const guild = await prisma.guild.findUnique({ where: { id: entry.guildId } });

      // No log channel configured — do not fall back to any other channel
      if (!guild?.logChannelId) {
        logger.debug(`[Audit] No logChannelId set for guild ${entry.guildId} — skipping ${entry.action}`);
        return;
      }

      logger.info(`[Audit] Routing ${entry.action} → channel ${guild.logChannelId} (guild ${entry.guildId})`);

      // Use fetch instead of cache so this works after bot restarts
      let channel: TextChannel;
      try {
        const fetched = await client.channels.fetch(guild.logChannelId);
        if (!fetched || !fetched.isTextBased() || fetched.isDMBased()) {
          logger.warn(`[Audit] logChannelId ${guild.logChannelId} is not a sendable text channel — skipping`);
          return;
        }
        channel = fetched as TextChannel;
        logger.info(`[Audit] Destination channel resolved: #${channel.name} (${channel.id})`);
      } catch {
        logger.warn(`[Audit] Could not fetch logChannelId ${guild.logChannelId} — channel may be deleted`);
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(Colors.NEUTRAL)
        .setTitle(`📋 ${entry.action.replace(/_/g, ' ')}`)
        .addFields(
          { name: 'Actor', value: `<@${entry.actorId}> (${entry.actorTag})`, inline: true },
          ...(entry.ticketId ? [{ name: 'Ticket', value: entry.ticketId, inline: true }] : []),
          ...(entry.oldValue ? [{ name: 'Before', value: entry.oldValue, inline: true }] : []),
          ...(entry.newValue ? [{ name: 'After', value: entry.newValue, inline: true }] : []),
          ...(entry.reason ? [{ name: 'Reason', value: entry.reason }] : []),
        )
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error('AuditService.log error', err);
    }
  }
}
