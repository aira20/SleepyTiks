import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import { Colors } from '../../types';

export const data = new SlashCommandBuilder()
  .setName('panel')
  .setDescription('Post the ticket panel in this channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setTitle('🎫 Create a Ticket')
    .setDescription('Select your language to get started.\n\nPilih bahasa Anda untuk memulai.')
    .setColor(Colors.PRIMARY);

  const langRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('ticket:lang_select')
      .setPlaceholder('Language / Bahasa')
      .addOptions([
        { label: '🇺🇸 English', value: 'en' },
        { label: '🇮🇩 Indonesia', value: 'id' },
      ]),
  );

  if (!interaction.channel || !interaction.channel.isSendable()) {
    return interaction.reply({ content: 'This command must be run in a sendable text channel.', ephemeral: true });
  }

  await interaction.channel.send({ embeds: [embed], components: [langRow] });
  await interaction.reply({ content: 'Panel posted!', ephemeral: true });
}
