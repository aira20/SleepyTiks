import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { prisma } from '../../utils/prisma';
import { successEmbed } from '../../components/embeds/success';

export const data = new SlashCommandBuilder()
  .setName('priority')
  .setDescription('Set the priority of this ticket')
  .addStringOption(o =>
    o.setName('level').setDescription('Priority level').setRequired(true)
      .addChoices(
        { name: 'Low',      value: 'LOW' },
        { name: 'Medium',   value: 'MEDIUM' },
        { name: 'High',     value: 'HIGH' },
        { name: 'Critical', value: 'CRITICAL' },
      ));

export async function execute(interaction: ChatInputCommandInteraction) {
  const level = interaction.options.getString('level', true);
  const ticket = await prisma.ticket.findFirst({ where: { channelId: interaction.channelId } });
  if (!ticket) return interaction.reply({ content: 'No ticket found in this channel.', ephemeral: true });
  await prisma.ticket.update({ where: { id: ticket.id }, data: { priority: level as any } });
  await interaction.reply({ embeds: [successEmbed(`Priority set to **${level}**.`)], ephemeral: true });
}
