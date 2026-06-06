import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { TicketManager } from '../../modules/tickets/TicketManager';
import { prisma } from '../../utils/prisma';

export const data = new SlashCommandBuilder()
  .setName('claim')
  .setDescription('Claim this ticket as your own');

export async function execute(interaction: ChatInputCommandInteraction) {
  const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channelId, status: { not: 'CLOSED' } } });
  if (!ticket) return interaction.reply({ content: 'This channel is not an active ticket.', ephemeral: true });
  await interaction.deferReply({ ephemeral: true });
  await TicketManager.claim(ticket.id, interaction.user.id, interaction.user.tag);
  await interaction.editReply({ content: 'You have claimed this ticket.' });
}
