import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { TicketManager } from '../../modules/tickets/TicketManager';
import { prisma } from '../../utils/prisma';

export const data = new SlashCommandBuilder()
  .setName('reopen')
  .setDescription('Reopen a closed ticket');

export async function execute(interaction: ChatInputCommandInteraction) {
  const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channelId, status: 'CLOSED' } });
  if (!ticket) return interaction.reply({ content: 'No closed ticket found in this channel.', ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  await TicketManager.reopen(ticket.id, interaction.user.id, interaction.user.tag);
  await interaction.editReply({ content: 'Ticket reopened.' });
}
