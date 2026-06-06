import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../components/embeds/success';
import { prisma } from '../../utils/prisma';

export const data = new SlashCommandBuilder()
  .setName('remove-user')
  .setDescription('Remove a user from this ticket')
  .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user', true);
  const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channelId } });
  if (!ticket) return interaction.reply({ content: 'No ticket found in this channel.', ephemeral: true });
  const channel = interaction.channel;
  if (!channel || !('permissionOverwrites' in channel)) return;
  await channel.permissionOverwrites.delete(user.id);
  await interaction.reply({ embeds: [successEmbed(`Removed <@${user.id}> from this ticket.`)] });
}
