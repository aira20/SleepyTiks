import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { MiddlemanManager } from '../../modules/middleman/MiddlemanManager';
import { prisma } from '../../utils/prisma';

const mm = new MiddlemanManager();

export const data = new SlashCommandBuilder()
  .setName('mm-cancel')
  .setDescription('Cancel this transaction')
  .addStringOption(o => o.setName('reason').setDescription('Reason for cancellation').setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  const reason = interaction.options.getString('reason') ?? 'No reason provided';
  const ticket = await prisma.ticket.findFirst({
    where: { channelId: interaction.channelId, transactionId: { not: null } },
    select: { transactionId: true },
  });
  if (!ticket?.transactionId) return interaction.reply({ content: 'No active transaction found in this channel.', ephemeral: true });
  await mm.cancelTransaction(ticket.transactionId, interaction.user.id, interaction.user.tag, reason, interaction);
}
