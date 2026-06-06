import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import { prisma } from '../../utils/prisma';
import { Colors } from '../../types/index';

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Configure bot settings')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand(sub => sub
    .setName('view')
    .setDescription('View current configuration'))
  .addSubcommand(sub => sub
    .setName('log-channel')
    .setDescription('Set the channel where audit logs are posted (must NOT be your panel channel)')
    .addChannelOption(o => o
      .setName('channel')
      .setDescription('Dedicated log channel — keep this separate from your ticket panel channel')
      .setRequired(true)
      .addChannelTypes(ChannelType.GuildText)))
  .addSubcommand(sub => sub
    .setName('staff-role')
    .setDescription('Set the staff role')
    .addRoleOption(o => o
      .setName('role')
      .setDescription('Staff role')
      .setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub   = interaction.options.getSubcommand();
  const guild = await prisma.guild.findUnique({ where: { id: interaction.guildId! } });

  if (sub === 'view') {
    if (!guild) {
      return interaction.reply({ content: 'Bot not set up. Run `/setup` first.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setTitle('Bot Configuration')
      .addFields(
        { name: 'Log Channel', value: guild.logChannelId ? `<#${guild.logChannelId}>` : '⚠️ Not set — audit logs are disabled', inline: false },
        { name: 'Staff Roles', value: guild.staffRoleIds.length ? guild.staffRoleIds.map(id => `<@&${id}>`).join(', ') : '⚠️ Not set', inline: false },
        { name: 'Support Category', value: guild.supportCategoryId ? `<#${guild.supportCategoryId}>` : 'Not set', inline: true },
        { name: 'Purchase Category', value: guild.purchaseCategoryId ? `<#${guild.purchaseCategoryId}>` : 'Not set', inline: true },
        { name: 'Middleman Category', value: guild.middlemanCategoryId ? `<#${guild.middlemanCategoryId}>` : 'Not set', inline: true },
        { name: 'Report Category', value: guild.reportCategoryId ? `<#${guild.reportCategoryId}>` : 'Not set', inline: true },
        { name: 'Premium', value: guild.isPremium ? `Active (${guild.premiumTier})` : 'Inactive', inline: true },
      )
      .setFooter({ text: 'Use /config log-channel to set a dedicated log channel separate from your panel channel.' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === 'log-channel') {
    const channel = interaction.options.getChannel('channel', true);

    // Warn if this looks like it might be the panel channel
    // We can't know for certain which channel has the panel, but we can warn
    const embed = new EmbedBuilder()
      .setColor(Colors.SUCCESS)
      .setTitle('✅ Log Channel Updated')
      .setDescription(
        `Audit logs will now be sent to <#${channel.id}>.\n\n` +
        `⚠️ **Important:** Make sure this is a **dedicated log channel**, not the channel where your ticket panel is posted. ` +
        `If your panel channel and log channel are the same, audit messages will clutter your panel.`
      );

    await prisma.guild.update({ where: { id: interaction.guildId! }, data: { logChannelId: channel.id } });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === 'staff-role') {
    const role = interaction.options.getRole('role', true);
    await prisma.guild.update({ where: { id: interaction.guildId! }, data: { staffRoleIds: [role.id] } });
    return interaction.reply({ content: `Staff role updated to <@&${role.id}>.`, ephemeral: true });
  }
}
