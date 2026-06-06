import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { successEmbed } from '../../components/embeds/success';
import { prisma } from '../../utils/prisma';

export const data = new SlashCommandBuilder()
  .setName('add-user')
  .setDescription('Add a user to this ticket')
  .addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  const user = interaction.options.getUser('user', true);
  const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channelId } });
  if (!ticket) return interaction.reply({ content: 'No ticket found in this channel.', ephemeral: true });
  const channel = interaction.channel;
  if (!channel || !('permissionOverwrites' in channel)) return;
  await channel.permissionOverwrites.create(user.id, { ViewChannel: true, SendMessages: true });
  await interaction.reply({ embeds: [successEmbed(`Added <@${user.id}> to this ticket.`)] });
}
