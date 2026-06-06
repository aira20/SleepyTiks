import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  RoleSelectMenuBuilder,
  RoleSelectMenuInteraction,
  ChannelSelectMenuBuilder,
  ChannelSelectMenuInteraction,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ChannelType,
} from 'discord.js';
import { prisma } from '../../utils/prisma';
import { Colors } from '../../types/index';
import { canAccessAdminPanel } from '../../utils/permissions';

export const data = new SlashCommandBuilder()
  .setName('adminpanel')
  .setDescription('Open the bot administration panel')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// ── Main panel embed + section dropdown ──────────────────────────────────────

function buildMainPanel(guildName: string): { embeds: EmbedBuilder[]; components: ActionRowBuilder<StringSelectMenuBuilder>[] } {
  const embed = new EmbedBuilder()
    .setColor(Colors.PRIMARY)
    .setTitle('⚙️ Administration Panel')
    .setDescription(`**${guildName}**\n\nSelect a section below to configure the bot.`)
    .addFields(
      { name: '📁 Categories', value: 'Configure ticket channel categories', inline: true },
      { name: '👥 Roles', value: 'Set staff, admin, and moderator roles', inline: true },
      { name: '📝 Logs', value: 'Set log and transcript channels', inline: true },
      { name: '🎫 Ticket Settings', value: 'Cooldowns, limits, auto-close', inline: true },
      { name: '💰 Middleman', value: 'Fee settings and categories', inline: true },
    )
    .setFooter({ text: 'Changes save immediately. No restart required.' })
    .setTimestamp();

  const select = new StringSelectMenuBuilder()
    .setCustomId('adminpanel:section')
    .setPlaceholder('Select a section to configure...')
    .addOptions([
      { label: '📁 Categories', description: 'Configure ticket channel categories', value: 'categories' },
      { label: '👥 Roles', description: 'Set staff, admin, and moderator roles', value: 'roles' },
      { label: '📝 Logs', description: 'Set log and transcript channels', value: 'logs' },
      { label: '🎫 Ticket Settings', description: 'Cooldowns, limits, auto-close', value: 'tickets' },
      { label: '💰 Middleman Settings', description: 'Fee settings and categories', value: 'middleman' },
    ]);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
  };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const member = await interaction.guild!.members.fetch(interaction.user.id);
  const guild = await prisma.guild.findUnique({ where: { id: interaction.guildId! } });

  if (!guild || !canAccessAdminPanel(member, guild)) {
    await interaction.reply({ content: '❌ You do not have permission to access the admin panel.', ephemeral: true });
    return;
  }

  const panel = buildMainPanel(interaction.guild!.name);
  await interaction.reply({ ...panel, ephemeral: true });
}

// ── Section select handler ────────────────────────────────────────────────────

export async function handleSelect(interaction: StringSelectMenuInteraction | RoleSelectMenuInteraction | ChannelSelectMenuInteraction) {
  const parts = interaction.customId.split(':');
  const prefix = parts[0];
  const action = parts[1];
  const field = parts[2]; // present for setchannel:FIELD and setroles:FIELD

  if (prefix !== 'adminpanel') return;

  const guildId = interaction.guildId!;
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild) { await interaction.update({ content: 'Bot not configured.', components: [] }); return; }

  const member = await interaction.guild!.members.fetch(interaction.user.id);
  if (!canAccessAdminPanel(member, guild)) {
    await interaction.reply({ content: '❌ Permission denied.', ephemeral: true });
    return;
  }

  // ── Section navigation ──────────────────────────────────────────────────
  if (action === 'section' && interaction.isStringSelectMenu()) {
    const section = interaction.values[0];

    if (section === 'categories') {
      const embed = new EmbedBuilder()
        .setColor(Colors.PRIMARY)
        .setTitle('📁 Category Configuration')
        .setDescription('Select a category for each ticket type. Changes save immediately.')
        .addFields(
          { name: 'Support', value: guild.supportCategoryId ? `<#${guild.supportCategoryId}>` : 'Not set', inline: true },
          { name: 'Purchase', value: guild.purchaseCategoryId ? `<#${guild.purchaseCategoryId}>` : 'Not set', inline: true },
          { name: 'Middleman', value: guild.middlemanCategoryId ? `<#${guild.middlemanCategoryId}>` : 'Not set', inline: true },
          { name: 'Report', value: guild.reportCategoryId ? `<#${guild.reportCategoryId}>` : 'Not set', inline: true },
          { name: 'Appeal', value: guild.appealCategoryId ? `<#${guild.appealCategoryId}>` : 'Not set', inline: true },
          { name: 'Partner', value: guild.partnerCategoryId ? `<#${guild.partnerCategoryId}>` : 'Not set', inline: true },
        );

      const typeSelect = new StringSelectMenuBuilder()
        .setCustomId('adminpanel:cattype')
        .setPlaceholder('Select which category to configure...')
        .addOptions([
          { label: 'Support Category', value: 'supportCategoryId' },
          { label: 'Purchase Category', value: 'purchaseCategoryId' },
          { label: 'Middleman Category', value: 'middlemanCategoryId' },
          { label: 'Report Category', value: 'reportCategoryId' },
          { label: 'Appeal Category', value: 'appealCategoryId' },
          { label: 'Partner Category', value: 'partnerCategoryId' },
        ]);

      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('adminpanel:back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
      );

      await interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(typeSelect),
          backRow,
        ],
      });
      return;
    }

    if (section === 'roles') {
      const embed = new EmbedBuilder()
        .setColor(Colors.PRIMARY)
        .setTitle('👥 Role Configuration')
        .setDescription('Select roles for each permission level.')
        .addFields(
          { name: 'Staff Roles', value: guild.staffRoleIds.length ? guild.staffRoleIds.map(id => `<@&${id}>`).join(', ') : 'Not set', inline: false },
          { name: 'Admin Roles', value: guild.adminRoleIds.length ? guild.adminRoleIds.map(id => `<@&${id}>`).join(', ') : 'Not set', inline: false },
        );

      const roleTypeSelect = new StringSelectMenuBuilder()
        .setCustomId('adminpanel:roletype')
        .setPlaceholder('Select which roles to configure...')
        .addOptions([
          { label: 'Staff Roles', description: 'Can close, claim, move, escalate tickets', value: 'staffRoleIds' },
          { label: 'Admin Roles', description: 'Can delete tickets and access admin panel', value: 'adminRoleIds' },
        ]);

      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('adminpanel:back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
      );

      await interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleTypeSelect),
          backRow,
        ],
      });
      return;
    }

    if (section === 'logs') {
      const embed = new EmbedBuilder()
        .setColor(Colors.PRIMARY)
        .setTitle('📝 Log Channel Configuration')
        .setDescription('Select channels for logging. Keep these separate from your panel channel.')
        .addFields(
          { name: 'Log Channel', value: guild.logChannelId ? `<#${guild.logChannelId}>` : '⚠️ Not set', inline: true },
          { name: 'Transcript Channel', value: guild.transcriptChannelId ? `<#${guild.transcriptChannelId}>` : 'Not set', inline: true },
        );

      const logTypeSelect = new StringSelectMenuBuilder()
        .setCustomId('adminpanel:logtype')
        .setPlaceholder('Select which log channel to configure...')
        .addOptions([
          { label: 'Audit Log Channel', description: 'Ticket events and staff actions', value: 'logChannelId' },
          { label: 'Transcript Channel', description: 'Deleted ticket transcripts', value: 'transcriptChannelId' },
        ]);

      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('adminpanel:back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
      );

      await interaction.update({
        embeds: [embed],
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(logTypeSelect),
          backRow,
        ],
      });
      return;
    }

    if (section === 'tickets') {
      const embed = new EmbedBuilder()
        .setColor(Colors.PRIMARY)
        .setTitle('🎫 Ticket Settings')
        .addFields(
          { name: 'Cooldown', value: `${guild.ticketCooldownSeconds}s`, inline: true },
          { name: 'Max Open Per User', value: `${guild.maxOpenTicketsPerUser}`, inline: true },
          { name: 'Auto-close After', value: `${guild.autoCloseInactiveDays} days`, inline: true },
          { name: 'Transcripts', value: guild.transcriptsEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Ratings', value: guild.ratingsEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
          { name: 'Require Reason on Close', value: guild.requireReasonOnClose ? '✅ Yes' : '❌ No', inline: true },
        )
        .setDescription('Use the toggles below to update settings.');

      const toggleRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('adminpanel:toggle:transcriptsEnabled').setLabel(`Transcripts: ${guild.transcriptsEnabled ? 'ON' : 'OFF'}`).setStyle(guild.transcriptsEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('adminpanel:toggle:ratingsEnabled').setLabel(`Ratings: ${guild.ratingsEnabled ? 'ON' : 'OFF'}`).setStyle(guild.ratingsEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('adminpanel:toggle:requireReasonOnClose').setLabel(`Require Reason: ${guild.requireReasonOnClose ? 'ON' : 'OFF'}`).setStyle(guild.requireReasonOnClose ? ButtonStyle.Success : ButtonStyle.Secondary),
      );

      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('adminpanel:back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
      );

      await interaction.update({ embeds: [embed], components: [toggleRow, backRow] });
      return;
    }

    if (section === 'middleman') {
      const embed = new EmbedBuilder()
        .setColor(Colors.PRIMARY)
        .setTitle('💰 Middleman Settings')
        .setDescription('Configure middleman transaction settings.')
        .addFields(
          { name: 'Middleman Category', value: guild.middlemanCategoryId ? `<#${guild.middlemanCategoryId}>` : '⚠️ Not set', inline: true },
          { name: 'Fee Structure', value: 'Rp 20K–499K → Rp 10K\nRp 500K–999K → Rp 20K\nRp 1M–1.49M → Rp 30K\nRp 1.5M–2.99M → Rp 40K\nRp 3M–4.99M → Rp 50K\nRp 5M–9.99M → Rp 100K\nRp 10M+ → Rp 200K', inline: false },
        );

      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('adminpanel:back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
      );

      await interaction.update({ embeds: [embed], components: [backRow] });
      return;
    }
  }

  // ── Category type selected → show channel select ────────────────────────
  if (action === 'cattype' && interaction.isStringSelectMenu()) {
    const field = interaction.values[0];
    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId(`adminpanel:setchannel:${field}`)
      .setPlaceholder('Select a category channel...')
      .addChannelTypes(ChannelType.GuildCategory);

    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('adminpanel:back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
    );

    await interaction.update({
      embeds: [new EmbedBuilder().setColor(Colors.PRIMARY).setTitle('📁 Select Category').setDescription(`Select the Discord category for **${field.replace('CategoryId', '').replace(/([A-Z])/g, ' $1').trim()}** tickets.`)],
      components: [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect), backRow],
    });
    return;
  }

  // ── Channel selected → save ──────────────────────────────────────────────
  if (action === 'setchannel' && field && interaction.isChannelSelectMenu()) {
    const channelId = interaction.values[0];
    await prisma.guild.update({ where: { id: guildId }, data: { [field]: channelId } });

    await interaction.update({
      embeds: [new EmbedBuilder().setColor(Colors.SUCCESS).setTitle('✅ Settings Updated').setDescription(`<#${channelId}> has been set as the **${field.replace('CategoryId', '').replace('ChannelId', '').replace(/([A-Z])/g, ' $1').trim()}** channel.`)],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('adminpanel:back').setLabel('← Back to Panel').setStyle(ButtonStyle.Secondary),
      )],
    });
    return;
  }

  // ── Role type selected → show role select ───────────────────────────────
  if (action === 'roletype' && interaction.isStringSelectMenu()) {
    const field = interaction.values[0];
    const roleSelect = new RoleSelectMenuBuilder()
      .setCustomId(`adminpanel:setroles:${field}`)
      .setPlaceholder('Select roles...')
      .setMinValues(1)
      .setMaxValues(10);

    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('adminpanel:back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
    );

    await interaction.update({
      embeds: [new EmbedBuilder().setColor(Colors.PRIMARY).setTitle('👥 Select Roles').setDescription(`Select the roles for **${field.replace('RoleIds', '').replace(/([A-Z])/g, ' $1').trim()}**. You can select multiple.`)],
      components: [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect), backRow],
    });
    return;
  }

  // ── Roles selected → save ────────────────────────────────────────────────
  if (action === 'setroles' && field && interaction.isRoleSelectMenu()) {
    const roleIds = interaction.values;
    await prisma.guild.update({ where: { id: guildId }, data: { [field]: roleIds } });

    const roleList = roleIds.map(id => `<@&${id}>`).join(', ');
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(Colors.SUCCESS).setTitle('✅ Settings Updated').setDescription(`**${field.replace('RoleIds', '').replace(/([A-Z])/g, ' $1').trim()} Roles** updated to: ${roleList}`)],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('adminpanel:back').setLabel('← Back to Panel').setStyle(ButtonStyle.Secondary),
      )],
    });
    return;
  }

  // ── Log type selected → show channel select ──────────────────────────────
  if (action === 'logtype' && interaction.isStringSelectMenu()) {
    const field = interaction.values[0];
    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId(`adminpanel:setchannel:${field}`)
      .setPlaceholder('Select a text channel...')
      .addChannelTypes(ChannelType.GuildText);

    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('adminpanel:back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
    );

    await interaction.update({
      embeds: [new EmbedBuilder().setColor(Colors.PRIMARY).setTitle('📝 Select Log Channel').setDescription(`Select the channel for **${field.replace('ChannelId', '').replace(/([A-Z])/g, ' $1').trim()}**.\n\n⚠️ Do NOT select your panel channel.`)],
      components: [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect), backRow],
    });
    return;
  }
}

// ── Button handler ────────────────────────────────────────────────────────────

export async function handleButton(interaction: ButtonInteraction) {
  const [prefix, action, field] = interaction.customId.split(':');
  if (prefix !== 'adminpanel') return;

  const guildId = interaction.guildId!;
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild) return;

  const member = await interaction.guild!.members.fetch(interaction.user.id);
  if (!canAccessAdminPanel(member, guild)) {
    await interaction.reply({ content: '❌ Permission denied.', ephemeral: true });
    return;
  }

  if (action === 'back') {
    const panel = buildMainPanel(interaction.guild!.name);
    await interaction.update(panel);
    return;
  }

  if (action === 'toggle' && field) {
    const key = field as 'transcriptsEnabled' | 'ratingsEnabled' | 'requireReasonOnClose';
    const current = guild[key] as boolean;
    await prisma.guild.update({ where: { id: guildId }, data: { [key]: !current } });

    const updated = await prisma.guild.findUnique({ where: { id: guildId } });
    if (!updated) return;

    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setTitle('🎫 Ticket Settings')
      .addFields(
        { name: 'Cooldown', value: `${updated.ticketCooldownSeconds}s`, inline: true },
        { name: 'Max Open Per User', value: `${updated.maxOpenTicketsPerUser}`, inline: true },
        { name: 'Auto-close After', value: `${updated.autoCloseInactiveDays} days`, inline: true },
        { name: 'Transcripts', value: updated.transcriptsEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
        { name: 'Ratings', value: updated.ratingsEnabled ? '✅ Enabled' : '❌ Disabled', inline: true },
        { name: 'Require Reason on Close', value: updated.requireReasonOnClose ? '✅ Yes' : '❌ No', inline: true },
      )
      .setDescription(`✅ **${key.replace(/([A-Z])/g, ' $1').trim()}** set to **${!current ? 'ON' : 'OFF'}**.`);

    const toggleRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('adminpanel:toggle:transcriptsEnabled').setLabel(`Transcripts: ${updated.transcriptsEnabled ? 'ON' : 'OFF'}`).setStyle(updated.transcriptsEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('adminpanel:toggle:ratingsEnabled').setLabel(`Ratings: ${updated.ratingsEnabled ? 'ON' : 'OFF'}`).setStyle(updated.ratingsEnabled ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('adminpanel:toggle:requireReasonOnClose').setLabel(`Require Reason: ${updated.requireReasonOnClose ? 'ON' : 'OFF'}`).setStyle(updated.requireReasonOnClose ? ButtonStyle.Success : ButtonStyle.Secondary),
    );

    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('adminpanel:back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
    );

    await interaction.update({ embeds: [embed], components: [toggleRow, backRow] });
    return;
  }
}
