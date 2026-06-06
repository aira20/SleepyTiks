import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { MetricsCollector } from '../../modules/analytics/MetricsCollector';
import { PremiumService } from '../../services/PremiumService';
import { errorEmbed } from '../../components/embeds/error';

const metrics = new MetricsCollector();
const premium = new PremiumService();

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View the staff leaderboard');

export async function execute(interaction: ChatInputCommandInteraction) {
  const isPremium = await premium.isPremium(interaction.guildId!);
  if (!isPremium) return interaction.reply({ embeds: [errorEmbed('Staff leaderboard requires Premium.')], ephemeral: true });
  await metrics.showLeaderboard(interaction.guildId!, interaction);
}
