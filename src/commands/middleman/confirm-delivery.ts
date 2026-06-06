import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { MiddlemanManager } from '../../modules/middleman/MiddlemanManager';
import { prisma } from '../../utils/prisma';
import { errorEmbed } from '../../components/embeds/error';

const mm = new MiddlemanManager();

export const data = new SlashCommandBuilder()
  .setName('mm-confirm-delivery')
  .setDescription('Confirm that the item has been delivered (buyer only)');

export async function execute(interaction: ChatInputCommandInteraction) {
  const ticket = await prisma.ticket.findFirst({
    where: { channelId: interaction.channelId, transactionId: { not: null } },
    include: { transaction: true },
  });
  const tx = ticket?.transaction;
  if (!tx) return interaction.reply({ embeds: [errorEmbed('No active transaction found in this channel.')], ephemeral: true });
  if (tx.buyerId !== interaction.user.id) return interaction.reply({ embeds: [errorEmbed('Only the buyer can confirm delivery.')], ephemeral: true });
  await mm.confirmDelivery(tx.id, interaction.user.id, interaction.user.tag, interaction);
}
