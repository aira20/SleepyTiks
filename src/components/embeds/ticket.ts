import { EmbedBuilder } from 'discord.js';
import { Ticket } from '@prisma/client';
import { Colors, TICKET_STATUS_DISPLAY, PRIORITY_DISPLAY } from '../../types';
import { formatDate, formatTicketId } from '../../utils/formatting';

export function buildTicketEmbed(ticket: Ticket): EmbedBuilder {
  const status = TICKET_STATUS_DISPLAY[ticket.status];
  const priority = PRIORITY_DISPLAY[ticket.priority];

  return new EmbedBuilder()
    .setColor(status.color)
    .setTitle(`${status.emoji} Ticket #${formatTicketId(ticket.id)}`)
    .addFields(
      { name: 'Type', value: ticket.type.replace(/_/g, ' '), inline: true },
      { name: 'Status', value: `${status.emoji} ${status.label}`, inline: true },
      { name: 'Priority', value: `${priority.emoji} ${priority.label}`, inline: true },
      { name: 'Created by', value: `<@${ticket.creatorId}>`, inline: true },
      { name: 'Assigned to', value: ticket.claimedById ? `<@${ticket.claimedById}>` : 'Unassigned', inline: true },
      { name: 'Opened', value: formatDate(ticket.createdAt), inline: true },
    )
    .setTimestamp();
}
