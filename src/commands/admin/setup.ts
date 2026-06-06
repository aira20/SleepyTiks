import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { prisma } from '../../utils/prisma';
import { successEmbed } from '../../components/embeds/success';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Initial bot setup for this server')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addChannelOption(o => o.setName('log-channel').setDescription('Channel for audit logs').setRequired(true).addChannelTypes(ChannelType.GuildText))
  .addChannelOption(o => o.setName('ticket-category').setDescription('Category where ticket channels are created').setRequired(true).addChannelTypes(ChannelType.GuildCategory))
  .addRoleOption(o => o.setName('staff-role').setDescription('Staff role').setRequired(true))
  .addChannelOption(o => o.setName('purchase-category').setDescription('Category for purchase tickets').setRequired(false).addChannelTypes(ChannelType.GuildCategory))
  .addChannelOption(o => o.setName('middleman-category').setDescription('Category for middleman tickets').setRequired(false).addChannelTypes(ChannelType.GuildCategory))
  .addChannelOption(o => o.setName('report-category').setDescription('Category for report tickets').setRequired(false).addChannelTypes(ChannelType.GuildCategory));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const logChannel        = interaction.options.getChannel('log-channel',        true);
  const ticketCategory    = interaction.options.getChannel('ticket-category',    true);
  const staffRole         = interaction.options.getRole('staff-role',            true);
  const purchaseCategory  = interaction.options.getChannel('purchase-category',  false);
  const middlemanCategory = interaction.options.getChannel('middleman-category', false);
  const reportCategory    = interaction.options.getChannel('report-category',    false);

  await prisma.guild.upsert({
    where:  { id: interaction.guildId! },
    create: {
      id: interaction.guildId!,
      name: interaction.guild?.name ?? 'Unknown',
      logChannelId: logChannel.id,
      supportCategoryId: ticketCategory.id,
      purchaseCategoryId: purchaseCategory?.id ?? ticketCategory.id,
      middlemanCategoryId: middlemanCategory?.id ?? ticketCategory.id,
      reportCategoryId: reportCategory?.id ?? ticketCategory.id,
      staffRoleIds: [staffRole.id],
    },
    update: {
      logChannelId: logChannel.id,
      supportCategoryId: ticketCategory.id,
      purchaseCategoryId: purchaseCategory?.id ?? ticketCategory.id,
      middlemanCategoryId: middlemanCategory?.id ?? ticketCategory.id,
      reportCategoryId: reportCategory?.id ?? ticketCategory.id,
      staffRoleIds: [staffRole.id],
    },
  });

  await interaction.editReply({
    embeds: [successEmbed(
      'Bot setup complete!\n\n' +
      `Log channel: <#${logChannel.id}>\n` +
      `Default ticket category: <#${ticketCategory.id}>\n` +
      `Staff role: <@&${staffRole.id}>\n\n` +
      'Use **/panel** to post the ticket panel.'
    )],
  });
}
