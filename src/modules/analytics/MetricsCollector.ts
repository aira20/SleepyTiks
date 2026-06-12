import { PrismaClient } from '@prisma/client';
import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { GuildAnalyticsSummary, StaffLeaderboardEntry, Colors } from '../../types';
import { formatDuration } from '../../utils/formatting';
import { errorEmbed } from '../../components/embeds/error';

const prisma = new PrismaClient();

export class MetricsCollector {
  static async getGuildSummary(guildId: string, period: 'day' | 'week' | 'month'): Promise<GuildAnalyticsSummary> {
    const since = this.periodStart(period);

    const [opened, closed, tickets, staffStats, transactions] = await Promise.all([
      prisma.ticket.count({ where: { guildId, createdAt: { gte: since } } }),
      prisma.ticket.count({ where: { guildId, closedAt: { gte: since } } }),
      prisma.ticket.findMany({ where: { guildId, createdAt: { gte: since } }, select: { type: true, responseTimeSec: true, rating: true } }),
      prisma.staffStats.findMany({ where: { guildId } }),
      prisma.transaction.findMany({
        where: { guildId, createdAt: { gte: since }, status: 'COMPLETED' },
        select: { price: true },
      }),
    ]);

    const responseTimes = tickets.filter(t => t.responseTimeSec).map(t => t.responseTimeSec!);
    const ratings = tickets.filter(t => t.rating).map(t => t.rating!);
    const avgFirstResponseSec = responseTimes.length
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;
    const avgRating = ratings.length
      ? parseFloat((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2))
      : null;

    // Tickets by type
    const ticketsByType: any = {};
    for (const t of tickets) {
      ticketsByType[t.type] = (ticketsByType[t.type] ?? 0) + 1;
    }

    // Top staff leaderboard
    const topStaff: StaffLeaderboardEntry[] = staffStats
      .map(s => ({
        userId: s.userId,
        userTag: s.userTag,
        ticketsClosed: s.ticketsClosed,
        avgResponseSec: s.ticketsClosed > 0
          ? Math.round(Number(s.totalFirstResponseMs) / s.ticketsClosed / 1000)
          : 0,
        avgRating: s.ratingCount > 0
          ? parseFloat((s.totalRatingScore / s.ratingCount).toFixed(2))
          : null,
        score: s.ticketsClosed * 10 + (s.ratingCount > 0 ? Math.round(s.totalRatingScore / s.ratingCount) * 5 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const transactionVolume = transactions.reduce((sum, t) => sum + Number(t.price), 0);

    return {
      period,
      ticketsOpened: opened,
      ticketsClosed: closed,
      avgFirstResponseSec,
      avgResolutionSec: 0, // extend later
      avgRating,
      topStaff,
      ticketsByType,
      transactionVolume,
      transactionCount: transactions.length,
    };
  }

  private static periodStart(period: 'day' | 'week' | 'month'): Date {
    const now = new Date();
    if (period === 'day')   return new Date(now.getTime() - 86_400_000);
    if (period === 'week')  return new Date(now.getTime() - 7 * 86_400_000);
    return new Date(now.getTime() - 30 * 86_400_000);
  }

  // ── Command-facing helpers 
  async showStaffStats(
    guildId: string,
    userId: string,
    userTag: string,
    interaction: ChatInputCommandInteraction,
  ) {
    const stats = await prisma.staffStats.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    if (!stats) {
      return interaction.reply({
        embeds: [errorEmbed(`No stats recorded yet for ${userTag}.`)],
        ephemeral: true,
      });
    }

    const avgResponseMs = stats.firstResponseCount > 0
      ? Number(stats.totalFirstResponseMs) / stats.firstResponseCount
      : 0;
    const avgResolutionMs = stats.resolutionCount > 0
      ? Number(stats.totalResolutionMs) / stats.resolutionCount
      : 0;
    const avgRating = stats.ratingCount > 0
      ? (stats.totalRatingScore / stats.ratingCount).toFixed(2)
      : 'N/A';

    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setTitle(`📊 Stats — ${userTag}`)
      .addFields(
        { name: 'Tickets Claimed',   value: String(stats.ticketsClaimed),       inline: true },
        { name: 'Tickets Closed',    value: String(stats.ticketsClosed),        inline: true },
        { name: 'Tickets Escalated', value: String(stats.ticketsEscalated),     inline: true },
        { name: 'Notes Left',        value: String(stats.notesLeft),            inline: true },
        { name: 'Messages',          value: String(stats.messagesInTickets),    inline: true },
        { name: 'Avg Rating',        value: avgRating,                          inline: true },
        { name: 'Avg First Response', value: formatDuration(avgResponseMs),     inline: true },
        { name: 'Avg Resolution',    value: formatDuration(avgResolutionMs),    inline: true },
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  async showLeaderboard(guildId: string, interaction: ChatInputCommandInteraction) {
    const summary = await MetricsCollector.getGuildSummary(guildId, 'month');

    if (summary.topStaff.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed('No staff activity recorded for the last 30 days.')],
        ephemeral: true,
      });
    }

    const lines = summary.topStaff.map((entry, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
      const rating = entry.avgRating != null ? ` · ⭐ ${entry.avgRating.toFixed(2)}` : '';
      return `${medal} **${entry.userTag}** — ${entry.ticketsClosed} closed${rating}`;
    });

    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setTitle('🏆 Staff Leaderboard (Last 30 Days)')
      .setDescription(lines.join('\n'));

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}