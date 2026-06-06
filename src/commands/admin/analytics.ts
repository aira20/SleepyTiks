import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { MetricsCollector } from '../../modules/analytics/MetricsCollector';
import { PremiumService } from '../../services/PremiumService';
import { buildErrorEmbed } from '../../components/embeds/error';

export const data = new SlashCommandBuilder()
  .setName('analytics')
  .setDescription('View server-wide analytics')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption(o =>
    o.setName('period').setDescription('Time period').setRequired(false)
      .addChoices(
        { name: 'Last 7 days',  value: '7d'  },
        { name: 'Last 30 days', value: '30d' },
        { name: 'All time',     value: 'all' },
      ));

export async function execute(interaction: ChatInputCommandInteraction) {
  const hasFeature = await PremiumService.hasFeature(interaction.guildId!, 'ADVANCED_ANALYTICS');
  if (!hasFeature) {
    return interaction.reply({ embeds: [buildErrorEmbed('Analytics require Premium.')], ephemeral: true });
  }

  const rawPeriod = interaction.options.getString('period') ?? '30d';
  const periodMap: Record<string, 'day' | 'week' | 'month'> = {
    '7d':  'week',
    '30d': 'month',
    'all': 'month',
  };
  const period = periodMap[rawPeriod] ?? 'month';

  await interaction.deferReply({ ephemeral: false });

  const summary = await MetricsCollector.getGuildSummary(interaction.guildId!, period);

  const topStaffLines = summary.topStaff.length
    ? summary.topStaff.slice(0, 5).map((s, i) =>
        `${i + 1}. <@${s.userId}> — ${s.ticketsClosed} closed | avg ${s.avgResponseSec}s response${s.avgRating ? ` | ⭐ ${s.avgRating}` : ''}`
      ).join('\n')
    : 'No data yet.';

  const typeLines = Object.entries(summary.ticketsByType ?? {})
    .map(([type, count]) => `${type}: ${count}`)
    .join('\n') || 'No data yet.';

  const embed = new EmbedBuilder()
    .setTitle(`📊 Analytics — Last ${rawPeriod}`)
    .setColor(0x5865F2)
    .addFields(
      { name: 'Tickets Opened',     value: String(summary.ticketsOpened),              inline: true },
      { name: 'Tickets Closed',     value: String(summary.ticketsClosed),              inline: true },
      { name: 'Avg First Response', value: `${summary.avgFirstResponseSec}s`,          inline: true },
      { name: 'Avg Rating',         value: summary.avgRating ? `⭐ ${summary.avgRating}` : 'N/A', inline: true },
      { name: 'Transactions',       value: String(summary.transactionCount),           inline: true },
      { name: 'Transaction Volume', value: `$${summary.transactionVolume.toFixed(2)}`, inline: true },
      { name: 'Tickets by Type',    value: typeLines },
      { name: '🏆 Top Staff',       value: topStaffLines },
    )
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}
