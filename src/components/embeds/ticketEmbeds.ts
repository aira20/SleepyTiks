import { EmbedBuilder, APIEmbedField } from 'discord.js';
import { Ticket, TicketStatus } from '@prisma/client';
import { Colors, TICKET_STATUS_DISPLAY } from '../../types/index';
import { formatTimestamp, ticketStatusBadge, priorityBadge, formatDuration } from '../../utils/formatting';

export function buildTicketInfoEmbed(ticket: Ticket): EmbedBuilder {
  const status = TICKET_STATUS_DISPLAY[ticket.status as TicketStatus];
  const fields: APIEmbedField[] = [
    { name: '👤 Created By', value: `<@${ticket.creatorId}>`, inline: true },
    { name: '📌 Status',     value: ticketStatusBadge(ticket.status), inline: true },
    { name: '🔥 Priority',   value: priorityBadge(ticket.priority),   inline: true },
    { name: '📅 Opened',     value: formatTimestamp(ticket.createdAt, 'F'), inline: true },
    ...(ticket.claimedById
      ? [{ name: '🙋 Claimed By', value: `<@${ticket.claimedById}>`, inline: true }]
      : []),
    ...(ticket.responseTimeSec
      ? [{ name: '⚡ First Response', value: formatDuration(ticket.responseTimeSec * 1000), inline: true }]
      : []),
  ];

  return new EmbedBuilder()
    .setColor(status.color)
    .setTitle(`${status.emoji} Ticket #${ticket.ticketNumber} — ${ticket.type.replace(/_/g, ' ')}`)
    .addFields(fields)
    .setFooter({ text: `ID: ${ticket.id}` })
    .setTimestamp();
}

export function buildNoteEmbed(note: { content: string; authorTag: string; createdAt: Date | string }): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.NEUTRAL)
    .setTitle('📝 Staff Note')
    .setDescription(note.content)
    .setFooter({ text: `By ${note.authorTag}` })
    .setTimestamp(new Date(note.createdAt));
}

export function buildTranscriptEmbed(ticket: Ticket): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.TRANSCRIPT)
    .setTitle('📋 Transcript Ready')
    .addFields(
      { name: 'Ticket', value: `#${ticket.ticketNumber}`, inline: true },
      { name: 'Type', value: ticket.type.replace(/_/g, ' '), inline: true },
      { name: 'Closed By', value: ticket.closedById ? `<@${ticket.closedById}>` : 'N/A', inline: true },
      { name: 'Transcript', value: ticket.transcriptUrl ?? 'Not available' },
    )
    .setTimestamp();
}

export function buildRatingEmbed(ticketNumber: number): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.GOLD)
    .setTitle('⭐ How did we do?')
    .setDescription(
      `Your ticket **#${ticketNumber}** has been closed.\n\n` +
      'Please rate your experience by clicking a button below. Your feedback helps us improve!'
    );
}
