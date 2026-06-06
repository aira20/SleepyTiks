import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { prisma } from '../../utils/prisma';
import { AuditService } from '../../services/AuditService';
import { successEmbed } from '../../components/embeds/success';

export const data = new SlashCommandBuilder()
  .setName('report-scam')
  .setDescription('Report a scammer')
  .addUserOption(o => o.setName('user').setDescription('User to report').setRequired(true))
  .addStringOption(o => o.setName('description').setDescription('Describe the scam').setRequired(true))
  .addStringOption(o => o.setName('evidence').setDescription('Link to evidence (screenshot, etc)').setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction) {
  const target      = interaction.options.getUser('user', true);
  const description = interaction.options.getString('description', true);
  const evidence    = interaction.options.getString('evidence') ?? null;

  await prisma.scamReport.create({
    data: {
      guildId: interaction.guildId!,
      reporterId: interaction.user.id,
      reporterTag: interaction.user.tag,
      accusedId: target.id,
      accusedTag: target.tag,
      scamType: 'OTHER',
      description,
      evidenceUrls: evidence ? [evidence] : [],
    },
  });

  await AuditService.log({
    guildId: interaction.guildId!,
    action: 'SCAM_REPORT_SUBMITTED',
    actorId: interaction.user.id,
    actorTag: interaction.user.tag,
    newValue: target.tag,
    reason: description.slice(0, 200),
  });

  await interaction.reply({ embeds: [successEmbed(`Scam report submitted against <@${target.id}>. Staff have been notified.`)], ephemeral: true });
}
