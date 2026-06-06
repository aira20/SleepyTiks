import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { TicketManager } from '../../modules/tickets/TicketManager';
import { prisma } from '../../utils/prisma';

export const data = new SlashCommandBuilder()
  .setName('transfer')
  .setDescription('Transfer this ticket to another staff member')
  .addUserOption(o => o.setName('staff').setDescription('Staff member to transfer to').setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser('staff', true);
  const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channelId, status: { not: 'CLOSED' } } });
  if (!ticket) return interaction.reply({ content: 'This channel is not an active ticket.', ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  await TicketManager.transfer({
    ticketId: ticket.id,
    newStaffId: target.id,
    newStaffTag: target.tag,
    transferredById: interaction.user.id,
    transferredByTag: interaction.user.tag,
  });
  await interaction.editReply({ content: `Ticket transferred to <@${target.id}>.` });
}
