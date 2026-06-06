import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { TicketType } from '@prisma/client';
import { TICKET_FORMS } from '../../types/index';

export function buildTicketModal(type: TicketType): ModalBuilder {
  const fields = TICKET_FORMS[type];
  if (!fields || fields.length === 0) {
    return new ModalBuilder()
      .setCustomId(`ticket:submit:${type}`)
      .setTitle(`Open ${type.replace(/_/g, ' ')} Ticket`)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('subject')
            .setLabel('Subject')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100)
        )
      );
  }

  const modal = new ModalBuilder()
    .setCustomId(`ticket:submit:${type}`)
    .setTitle(`Open ${type.replace(/_/g, ' ')} Ticket`);

  for (const field of fields.slice(0, 5)) {
    const input = new TextInputBuilder()
      .setCustomId(field.id)
      .setLabel(field.label)
      .setStyle(field.style === 'PARAGRAPH' ? TextInputStyle.Paragraph : TextInputStyle.Short)
      .setRequired(field.required);

    if (field.placeholder) input.setPlaceholder(field.placeholder);
    if (field.minLength)   input.setMinLength(field.minLength);
    if (field.maxLength)   input.setMaxLength(field.maxLength);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  }

  return modal;
}

export function buildCloseModal(ticketId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`ticket:close_confirm:${ticketId}`)
    .setTitle('Close Ticket')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reason for closing')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder('Optional — leave blank if resolved')
          .setMaxLength(200)
      )
    );
}

export function buildNoteModal(ticketId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`ticket:note_submit:${ticketId}`)
    .setTitle('Add Staff Note')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('note')
          .setLabel('Note (only visible to staff)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMaxLength(1000)
      )
    );
}

export function buildTransferModal(ticketId: string): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`ticket:transfer_submit:${ticketId}`)
    .setTitle('Transfer Ticket')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('user_id')
          .setLabel('Staff Member User ID')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setPlaceholder('Discord user ID of the staff member')
          .setMaxLength(20)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('Reason (optional)')
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setMaxLength(200)
      )
    );
}
