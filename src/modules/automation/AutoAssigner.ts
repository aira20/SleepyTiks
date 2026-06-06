import { PrismaClient } from '@prisma/client';
import { client } from '../../bot/client';
import { TicketManager } from '../tickets/TicketManager';
import { logger } from '../../utils/logger';

const prisma = new PrismaClient();

export class AutoAssigner {
  /**
   * Auto-assign a ticket to the least-busy online staff member.
   * Premium feature â€” only runs if guild.autoAssign is true.
   */
  static async assign(ticketId: string, guildId: string): Promise<boolean> {
    try {
      const guild = await prisma.guild.findUnique({ where: { id: guildId } });
      if (!guild || guild.staffRoleIds.length === 0) return false;

      const discordGuild = client.guilds.cache.get(guildId);
      if (!discordGuild) return false;

      const staffRoleId = guild.staffRoleIds[0];
      const staffRole = discordGuild.roles.cache.get(staffRoleId);
      if (!staffRole) return false;

      const onlineStaff = staffRole.members.filter(m =>
        m.presence?.status === 'online' || m.presence?.status === 'idle'
      );
      if (onlineStaff.size === 0) return false;

      // Find staff with fewest open claimed tickets
      const openCounts = await prisma.ticket.groupBy({
        by: ['claimedById'],
        where: {
          guildId,
          status: { notIn: ['CLOSED', 'ARCHIVED'] },
          claimedById: { in: onlineStaff.map(m => m.id) },
        },
        _count: { id: true },
      });

      const countMap = new Map(openCounts.map(r => [r.claimedById!, r._count.id]));

      let bestStaff = onlineStaff.first()!;
      let bestCount = countMap.get(bestStaff.id) ?? 0;

      for (const [, member] of onlineStaff) {
        const count = countMap.get(member.id) ?? 0;
        if (count < bestCount) {
          bestStaff = member;
          bestCount = count;
        }
      }

      await TicketManager.claim(ticketId, bestStaff.id, bestStaff.user.tag);
      logger.info(`Auto-assigned ticket ${ticketId} to ${bestStaff.user.tag}`);
      return true;
    } catch (err) {
      logger.error('AutoAssigner.assign error', err);
      return false;
    }
  }
}
