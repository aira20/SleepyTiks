import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { TicketManager } from '../../modules/tickets/TicketManager';
import { prisma } from '../../utils/prisma';

export const data = new SlashCommandBuilder()
  .setName('close')
  .setDescription('Close the current ticket')
  .addStringOption(o => o.setName('reason').setDescription('Reason for closing').setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channelId, status: { not: 'CLOSED' } } });
  if (!ticket) return interaction.reply({ content: 'This channel is not an active ticket.', ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  await TicketManager.close({ ticketId: ticket.id, closedById: interaction.user.id, closedByTag: interaction.user.tag, reason, generateTranscript: false });
  await interaction.editReply({ content: 'Ticket closed.' });
}
