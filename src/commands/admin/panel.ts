import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Colors } from '../../types';

export const data = new SlashCommandBuilder()
  .setName('panel')
  .setDescription('Post the ticket panel in this channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('Support & Marketplace Tickets')
    .setDescription(
      'Need help or want to start a trade?\n\n' +
      'Purchase - Buy products or services\n' +
      'Middleman - Secure trades with a middleman\n' +
      'Report - Report a scammer or issue\n' +
      'Support - General support request\n\n' +
      'Click a button below to open a ticket.'
    )
    .setColor(Colors.PRIMARY);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('ticket:PURCHASE').setLabel('Purchase').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('ticket:MIDDLEMAN').setLabel('Middleman').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('ticket:REPORT').setLabel('Report').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('ticket:SUPPORT').setLabel('Support').setStyle(ButtonStyle.Secondary),
  );

  if (!interaction.channel || !interaction.channel.isSendable()) {
    return interaction.reply({ content: 'This command must be run in a sendable text channel.', ephemeral: true });
  }

  await interaction.channel.send({ embeds: [embed], components: [row] });
  await interaction.reply({ content: 'Panel posted!', ephemeral: true });
}
