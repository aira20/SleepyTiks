import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { prisma } from '../../utils/prisma';
import { AuditService } from '../../services/AuditService';
import { successEmbed } from '../../components/embeds/success';

export const data = new SlashCommandBuilder()
  .setName('note')
  .setDescription('Add a staff note to this ticket')
  .addStringOption(o => o.setName('text').setDescription('Note content').setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  const text = interaction.options.getString('text', true);
  const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channelId } });
  if (!ticket) return interaction.reply({ content: 'No ticket found in this channel.', ephemeral: true });

  await prisma.staffNote.create({
    data: {
      ticketId: ticket.id,
      authorId: interaction.user.id,
      authorTag: interaction.user.tag,
      content: text,
    },
  });

  await AuditService.log({
    guildId: interaction.guildId!,
    ticketId: ticket.id,
    action: 'STAFF_NOTE_ADDED',
    actorId: interaction.user.id,
    actorTag: interaction.user.tag,
    newValue: text.slice(0, 200),
  });

  await interaction.reply({ embeds: [successEmbed('Note added successfully.')], ephemeral: true });
}
