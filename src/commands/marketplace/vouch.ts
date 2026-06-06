import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { VouchSystem } from '../../modules/marketplace/VouchSystem';
import { PremiumService } from '../../services/PremiumService';
import { errorEmbed } from '../../components/embeds/error';

const vouches = new VouchSystem();
const premium = new PremiumService();

export const data = new SlashCommandBuilder()
  .setName('vouch')
  .setDescription('Vouch for a user after a successful trade')
  .addUserOption(o => o.setName('user').setDescription('User to vouch for').setRequired(true))
  .addStringOption(o => o.setName('comment').setDescription('Optional comment').setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  const isPremium = await premium.isPremium(interaction.guildId!);
  if (!isPremium) return interaction.reply({ embeds: [errorEmbed('Vouch system requires Premium.')], ephemeral: true });

  const target  = interaction.options.getUser('user', true);
  const comment = interaction.options.getString('comment') ?? '';
  await vouches.giveVouch(interaction.guildId!, interaction.user.id, interaction.user.tag, target.id, target.tag, comment, interaction);
}
