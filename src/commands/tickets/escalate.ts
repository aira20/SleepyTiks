import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { TicketManager } from '../../modules/tickets/TicketManager';
import { prisma } from '../../utils/prisma';

export const data = new SlashCommandBuilder()
  .setName('escalate')
  .setDescription('Escalate this ticket to senior staff')
  .addStringOption(o => o.setName('reason').setDescription('Reason for escalation').setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  const reason = interaction.options.getString('reason', true);
  const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channelId, status: { not: 'CLOSED' } } });
  if (!ticket) return interaction.reply({ content: 'This channel is not an active ticket.', ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  await TicketManager.escalate({ ticketId: ticket.id, escalatedById: interaction.user.id, escalatedByTag: interaction.user.tag, reason });
  await interaction.editReply({ content: 'Ticket escalated.' });
}
