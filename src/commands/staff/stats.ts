import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { MetricsCollector } from '../../modules/analytics/MetricsCollector';
import { PremiumService } from '../../services/PremiumService';
import { errorEmbed } from '../../components/embeds/error';

const metrics = new MetricsCollector();
const premium = new PremiumService();

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View your ticket handling stats')
  .addUserOption(o => o.setName('user').setDescription('Staff member (defaults to you)').setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  const isPremium = await premium.isPremium(interaction.guildId!);
  if (!isPremium) return interaction.reply({ embeds: [errorEmbed('Staff analytics require Premium.')], ephemeral: true });

  const target = interaction.options.getUser('user') ?? interaction.user;
  await metrics.showStaffStats(interaction.guildId!, target.id, target.tag, interaction);
}
