import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { VouchSystem } from '../../modules/marketplace/VouchSystem';
import { PremiumService } from '../../services/PremiumService';
import { errorEmbed } from '../../components/embeds/error';

const vouches = new VouchSystem();
const premium = new PremiumService();

export const data = new SlashCommandBuilder()
  .setName('rep')
  .setDescription('View reputation of a user')
  .addUserOption(o => o.setName('user').setDescription('User to check (defaults to you)').setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  const isPremium = await premium.isPremium(interaction.guildId!);
  if (!isPremium) return interaction.reply({ embeds: [errorEmbed('Reputation system requires Premium.')], ephemeral: true });

  const target = interaction.options.getUser('user') ?? interaction.user;
  await vouches.showReputation(interaction.guildId!, target.id, target.tag, interaction);
}
