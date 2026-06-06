import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
} from 'discord.js';
import { PrismaClient, TicketType } from '@prisma/client';
import { Colors } from '../../types/index';

const prisma = new PrismaClient();

const TICKET_TYPES: TicketType[] = [
  'SUPPORT', 'PURCHASE', 'MIDDLEMAN', 'REPORT',
  'REFUND', 'PARTNERSHIP', 'SERVICE_REQUEST',
  'APPEAL', 'SELLER_APPLICATION', 'STAFF_APPLICATION',
];

export const data = new SlashCommandBuilder()
  .setName('resetticketcounters')
  .setDescription('[DEV] Reset per-type ticket counters by closing all ticket records of a type')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const guildId = interaction.guildId!;

  // Count open tickets per type
  const counts = await Promise.all(
    TICKET_TYPES.map(async type => ({
      type,
      total: await prisma.ticket.count({ where: { guildId, type } }),
      open: await prisma.ticket.count({ where: { guildId, type, status: { notIn: ['CLOSED', 'ARCHIVED'] } } }),
    }))
  );

  const active = counts.filter(c => c.total > 0);

  if (active.length === 0) {
    await interaction.editReply({ content: 'No ticket records found. Counters are already at zero.' });
    return;
  }

  const lines = active.map(c => {
    const prefix = c.type.toLowerCase().replace(/_/g, '-');
    const next = `${prefix}-${String(c.total + 1).padStart(3, '0')}`;
    return `**${c.type}** — ${c.total} total (${c.open} open) → next would be \`${next}\``;
  });

  const embed = new EmbedBuilder()
    .setColor(Colors.WARNING)
    .setTitle('⚠️ Reset Ticket Counters')
    .setDescription(
      'Counters are derived from existing ticket records in the database.\n\n' +
      '**Resetting** means closing all ticket DB records so the counter returns to 0.\n\n' +
      '**This does NOT delete channels, transcripts, or message history.**\n\n' +
      '**Current state:**\n' + lines.join('\n') + '\n\n' +
      '⚠️ If any numbered channels still exist in Discord, resetting may create duplicate names.\n' +
      'Make sure all numbered ticket channels are deleted first.'
    )
    .setFooter({ text: 'Development use only — do not run in production with active tickets.' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('resetticketcounters:confirm')
      .setLabel('Confirm Reset')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⚠️'),
    new ButtonBuilder()
      .setCustomId('resetticketcounters:cancel')
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleButton(interaction: ButtonInteraction) {
  const action = interaction.customId.split(':')[1];

  if (action === 'cancel') {
    await interaction.update({ content: 'Reset cancelled.', embeds: [], components: [] });
    return;
  }

  if (action === 'confirm') {
    await interaction.deferUpdate();
    const guildId = interaction.guildId!;

    // Archive ALL ticket records (including already-closed) so the count-based counter resets to 0
    const result = await prisma.ticket.updateMany({
      where: { guildId },
      data: { status: 'ARCHIVED' },
    });

    const embed = new EmbedBuilder()
      .setColor(Colors.SUCCESS)
      .setTitle('✅ Counters Reset')
      .setDescription(
        `${result.count} open ticket record(s) marked as ARCHIVED.\n\n` +
        'All type counters have been reset to 0.\n' +
        'The next ticket of each type will start at **001**.'
      );

    await interaction.editReply({ embeds: [embed], components: [] });
    return;
  }
}
