import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { Colors } from '../../types';

export const data = new SlashCommandBuilder()
  .setName('panel')
  .setDescription('Post the ticket panel in this channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('🎫 Create a Ticket')
    .setDescription('Choose a ticket type to get started.\n\nPilih jenis tiket untuk memulai.')
    .setColor(Colors.PRIMARY);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:type:MIDDLEMAN')
      .setLabel('Middleman')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('ticket:type:SUPPORT')
      .setLabel('Tickets')
      .setStyle(ButtonStyle.Secondary),
  );

  if (!interaction.channel || !interaction.channel.isSendable()) {
    return interaction.reply({ content: 'This command must be run in a sendable text channel.', ephemeral: true });
  }

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: 'Panel posted!', ephemeral: true });
}
