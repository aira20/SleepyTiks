import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function buildTicketControlRow(ticketId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket:claim:${ticketId}`)   .setLabel('Claim')     .setStyle(ButtonStyle.Primary)   .setEmoji('🙋'),
    new ButtonBuilder().setCustomId(`ticket:close:${ticketId}`)   .setLabel('Close')     .setStyle(ButtonStyle.Danger)    .setEmoji('🔒'),
    new ButtonBuilder().setCustomId(`ticket:note:${ticketId}`)    .setLabel('Add Note')  .setStyle(ButtonStyle.Secondary) .setEmoji('📝'),
    new ButtonBuilder().setCustomId(`ticket:transfer:${ticketId}`).setLabel('Transfer')  .setStyle(ButtonStyle.Secondary) .setEmoji('↔️'),
  );
}

export function buildEscalateRow(ticketId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket:escalate:${ticketId}`).setLabel('Escalate').setStyle(ButtonStyle.Danger).setEmoji('🔴'),
    new ButtonBuilder().setCustomId(`ticket:reopen:${ticketId}`)  .setLabel('Reopen')  .setStyle(ButtonStyle.Success).setEmoji('🔓'),
  );
}

export function buildRatingRow(ticketId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket:rate:${ticketId}:1`).setLabel('1⭐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket:rate:${ticketId}:2`).setLabel('2⭐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket:rate:${ticketId}:3`).setLabel('3⭐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket:rate:${ticketId}:4`).setLabel('4⭐').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`ticket:rate:${ticketId}:5`).setLabel('5⭐').setStyle(ButtonStyle.Success),
  );
}

export function buildTransactionRow(txId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`mm:confirm_payment:${txId}`) .setLabel('Confirm Payment') .setStyle(ButtonStyle.Success)  .setEmoji('✅'),
    new ButtonBuilder().setCustomId(`mm:confirm_delivery:${txId}`).setLabel('Confirm Delivery').setStyle(ButtonStyle.Primary)  .setEmoji('📦'),
    new ButtonBuilder().setCustomId(`mm:dispute:${txId}`)         .setLabel('Dispute')         .setStyle(ButtonStyle.Danger)   .setEmoji('⚠️'),
    new ButtonBuilder().setCustomId(`mm:cancel:${txId}`)          .setLabel('Cancel')          .setStyle(ButtonStyle.Secondary).setEmoji('❌'),
  );
}
