import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { BlacklistManager } from '../../modules/marketplace/BlacklistManager';
import { PremiumService } from '../../services/PremiumService';
import { errorEmbed } from '../../components/embeds/error';

const bl      = new BlacklistManager();
const premium = new PremiumService();

export const data = new SlashCommandBuilder()
  .setName('blacklist')
  .setDescription('Manage the server blacklist')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => sub.setName('add').setDescription('Add a user to the blacklist')
    .addUserOption(o => o.setName('user').setDescription('User to blacklist').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)))
  .addSubcommand(sub => sub.setName('remove').setDescription('Remove a user from the blacklist')
    .addUserOption(o => o.setName('user').setDescription('User to unblacklist').setRequired(true)))
  .addSubcommand(sub => sub.setName('check').setDescription('Check if a user is blacklisted')
    .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction) {
  const isPremium = await premium.isPremium(interaction.guildId!);
  if (!isPremium) return interaction.reply({ embeds: [errorEmbed('Blacklist system requires Premium.')], ephemeral: true });

  const sub  = interaction.options.getSubcommand();
  const user = interaction.options.getUser('user', true);

  if (sub === 'add') {
    const reason = interaction.options.getString('reason', true);
    await bl.addToBlacklist(interaction.guildId!, user.id, user.tag, interaction.user.id, interaction.user.tag, reason, interaction);
  } else if (sub === 'remove') {
    await bl.removeFromBlacklist(interaction.guildId!, user.id, user.tag, interaction.user.id, interaction.user.tag, interaction);
  } else {
    await bl.checkBlacklist(interaction.guildId!, user.id, user.tag, interaction);
  }
}
