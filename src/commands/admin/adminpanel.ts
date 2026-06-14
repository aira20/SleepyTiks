import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  StringSelectMenuInteraction,
  RoleSelectMenuBuilder,
  RoleSelectMenuInteraction,
  ChannelSelectMenuBuilder,
  ChannelSelectMenuInteraction,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalSubmitInteraction,
} from 'discord.js';
import { prisma } from '../../utils/prisma';
import { Colors } from '../../types/index';
import { canAccessAdminPanel } from '../../utils/permissions';
import { ensureGuildDefaults } from '../../utils/defaults';
import { formatIDR } from '../../utils/middlemanFee';

export const data = new SlashCommandBuilder()
  .setName('adminpanel')
  .setDescription('Open the bot administration panel')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

// ── Ini buat drop down di panelnya || UNTUK ADMIN PANEL - JANGAN DI UTAK UTIK

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
      { name: '💰 Payment Settings', value: 'Bank info, fee tiers, payment rules', inline: true },
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
      { label: '💰 Payment Settings', description: 'Bank info, fee tiers, payment rules', value: 'payment' },
    ]);

  return {
    embeds: [embed],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
  };
}

// ── Semua settingan payment di sini, satu tempat aja biar gampang

async function buildPaymentSettingsPayload(guildId: string): Promise<{
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[];
}> {
  const [paymentSettings, feeTiers, allRules] = await Promise.all([
    prisma.guildPaymentSettings.findUnique({ where: { guildId } }),
    prisma.middlemanFeeTier.findMany({ where: { guildId }, orderBy: { sortOrder: 'asc' } }),
    prisma.paymentFeeRule.findMany({ where: { guildId }, orderBy: { sortOrder: 'asc' } }),
  ]);

  const tierLines = feeTiers.map(t => {
    const max = t.maxAmount === null ? '∞' : `Rp ${formatIDR(t.maxAmount)}`;
    return `Rp ${formatIDR(t.minAmount)} – ${max} → **Rp ${formatIDR(t.fee)}**`;
  }).join('\n') || 'No tiers configured.';

  // BUAT BANK APA AJA YANG RECOMMENDED -- DISABLED JUGA BISA 
  // Database sortOrder is never changed here.
  const sorted = [...allRules].sort((a, b) => {
    const sa = (a.recommended ? 2 : 0) + (a.enabled ? 1 : 0);
    const sb = (b.recommended ? 2 : 0) + (b.enabled ? 1 : 0);
    return sb - sa;
  });

  const ruleLines = sorted.map(r => {
    const tags = [r.recommended ? '⭐' : '', r.enabled ? '✅' : '❌'].filter(Boolean).join(' ');
    const fee  = r.fee > 0 ? ` · Rp ${formatIDR(r.fee)}` : '';
    const desc = r.description ? ` · ${r.description}` : '';
    return `${tags} **${r.methodName}**${fee}${desc}`;
  }).join('\n') || 'No payment methods configured.';

  const customSettings = [
    `Allow Custom: ${paymentSettings?.allowCustomPaymentMethods ? '✅ Enabled' : '❌ Disabled'}`,
    `Custom Label: **${paymentSettings?.customMethodLabel ?? 'Other Payment Method'}**`,
    `Custom Fee: Rp ${formatIDR(paymentSettings?.customMethodFee ?? 2500)}`,
  ].join('\n');

  const embed = new EmbedBuilder()
    .setColor(Colors.PRIMARY)
    .setTitle('💰 Payment Settings')
    .setDescription('Configure payment info, middleman fee tiers, and payment method fees.')
    .addFields(
      {
        name: '🏦 Bank Information',
        value: [
          `**Bank:** ${paymentSettings?.bankName ?? 'BCA'}`,
          `**Account:** ${paymentSettings?.accountNumber ?? '6760315042'}`,
          `**Holder:** ${paymentSettings?.accountHolder ?? 'Azra Reza Satria H'}`,
          paymentSettings?.qrisImageUrl ? `**QRIS:** ${paymentSettings.qrisImageUrl}` : '',
        ].filter(Boolean).join('\n'),
        inline: false,
      },
      { name: '📊 Middleman Fee Tiers',    value: tierLines,      inline: false },
      { name: '💳 Payment Methods',        value: ruleLines,      inline: false },
      { name: '⚙️ Custom Payment Method', value: customSettings, inline: false },
    );

  const subsectionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('adminpanel:paymentsub')
      .setPlaceholder('Select what to configure...')
      .addOptions([
        { label: '🏦 Edit Bank Information',          description: 'Update bank name, account number, holder',  value: 'bankinfo' },
        { label: '➕ Add Fee Tier',                    description: 'Add a new middleman fee bracket',           value: 'tier_add' },
        { label: '✏️ Edit Fee Tier',                   description: 'Modify an existing fee bracket',           value: 'tier_edit' },
        { label: '🗑️ Delete Fee Tier',                 description: 'Remove a fee bracket',                     value: 'tier_delete' },
        { label: '➕ Add Payment Method',              description: 'Add a new payment method',                  value: 'rule_add' },
        { label: '✏️ Edit Payment Method',             description: 'Modify an existing payment method',         value: 'rule_edit' },
        { label: '🗑️ Delete Payment Method',           description: 'Remove a payment method',                  value: 'rule_delete' },
        { label: '✅ Manage Enabled Methods',          description: 'Bulk enable or disable payment methods',    value: 'rule_enabled' },
        { label: '⭐ Set Recommended Methods',         description: 'Bulk set recommended payment methods',      value: 'rule_recommend' },
        { label: '⚙️ Custom Payment Method Settings', description: 'Allow custom methods, set label and fee',   value: 'custom_settings' },
      ]),
  );

  const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('adminpanel:back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [subsectionRow, backRow] };
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

// ── Handler buat semua dropdown di admin panel

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

  // ── PILIHAN PANELS, ALL THE CHOICES YOU MAKE WHEN THE ADMIN PABNEL IS CALLED
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
          { name: '📢 Updates Channel', value: guild.updateChannelId ? `<#${guild.updateChannelId}>` : 'Not set', inline: true },
        );

      const logTypeSelect = new StringSelectMenuBuilder()
        .setCustomId('adminpanel:logtype')
        .setPlaceholder('Select which log channel to configure...')
        .addOptions([
          { label: 'Audit Log Channel', description: 'Ticket events and staff actions', value: 'logChannelId' },
          { label: 'Transcript Channel', description: 'Deleted ticket transcripts', value: 'transcriptChannelId' },
          { label: '📢 Updates Channel', description: 'Where update announcements are posted', value: 'updateChannelId' },
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

    if (section === 'payment') {
      await ensureGuildDefaults(guildId);
      await interaction.update(await buildPaymentSettingsPayload(guildId));
      return;
    }
  }

  // ── Kalau user pilih sub-section di dalem payment panel
  if (action === 'paymentsub' && interaction.isStringSelectMenu()) {
    const sub = interaction.values[0];
    const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('adminpanel:back:payment').setLabel('← Back').setStyle(ButtonStyle.Secondary),
    );

    if (sub === 'bankinfo') {
      const modal = new ModalBuilder()
        .setCustomId('adminpanel:modal:bankinfo')
        .setTitle('Edit Bank Information');

      const current = await prisma.guildPaymentSettings.findUnique({ where: { guildId } });

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('bankName').setLabel('Bank Name').setStyle(TextInputStyle.Short)
            .setValue(current?.bankName ?? 'BCA').setRequired(true).setMaxLength(50),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('accountNumber').setLabel('Account Number').setStyle(TextInputStyle.Short)
            .setValue(current?.accountNumber ?? '6760315042').setRequired(true).setMaxLength(50),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('accountHolder').setLabel('Account Holder Name').setStyle(TextInputStyle.Short)
            .setValue(current?.accountHolder ?? 'Azra Reza Satria H').setRequired(true).setMaxLength(100),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('qrisImageUrl').setLabel('QRIS Image URL (optional)').setStyle(TextInputStyle.Short)
            .setValue(current?.qrisImageUrl ?? '').setRequired(false).setMaxLength(500),
        ),
      );

      await interaction.showModal(modal);
      return;
    }

    if (sub === 'tier_add') {
      const modal = new ModalBuilder()
        .setCustomId('adminpanel:modal:tier_add')
        .setTitle('Add Fee Tier');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('minAmount').setLabel('Minimum Amount (IDR)').setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. 100000').setRequired(true).setMaxLength(15),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('maxAmount').setLabel('Maximum Amount (IDR)').setStyle(TextInputStyle.Short)
            .setPlaceholder('Leave blank for no upper limit, e.g. 499999').setRequired(false).setMaxLength(15),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('fee').setLabel('Fee Amount (IDR)').setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. 10000').setRequired(true).setMaxLength(15),
        ),
      );

      await interaction.showModal(modal);
      return;
    }

    if (sub === 'tier_edit') {
      const tiers = await prisma.middlemanFeeTier.findMany({ where: { guildId }, orderBy: { sortOrder: 'asc' } });
      if (tiers.length === 0) {
        await interaction.update({
          embeds: [new EmbedBuilder().setColor(Colors.WARNING).setTitle('⚠️ No Tiers').setDescription('No fee tiers exist. Add one first.')],
          components: [backRow],
        });
        return;
      }

      const options = tiers.slice(0, 25).map(t => {
        const max = t.maxAmount === null ? '∞' : `${formatIDR(t.maxAmount)}`;
        return { label: `Rp ${formatIDR(t.minAmount)} – ${max}`, description: `Fee: Rp ${formatIDR(t.fee)}`, value: t.id };
      });

      await interaction.update({
        embeds: [new EmbedBuilder().setColor(Colors.PRIMARY).setTitle('✏️ Select Tier to Edit')],
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder().setCustomId('adminpanel:tier_edit_select').setPlaceholder('Select a tier...').addOptions(options),
          ),
          backRow,
        ],
      });
      return;
    }

    if (sub === 'tier_delete') {
      const tiers = await prisma.middlemanFeeTier.findMany({ where: { guildId }, orderBy: { sortOrder: 'asc' } });
      if (tiers.length === 0) {
        await interaction.update({
          embeds: [new EmbedBuilder().setColor(Colors.WARNING).setTitle('⚠️ No Tiers').setDescription('No fee tiers to delete.')],
          components: [backRow],
        });
        return;
      }

      const options = tiers.slice(0, 25).map(t => {
        const max = t.maxAmount === null ? '∞' : `${formatIDR(t.maxAmount)}`;
        return { label: `Rp ${formatIDR(t.minAmount)} – ${max}`, description: `Fee: Rp ${formatIDR(t.fee)}`, value: t.id };
      });

      await interaction.update({
        embeds: [new EmbedBuilder().setColor(Colors.DANGER).setTitle('🗑️ Select Tier to Delete')],
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder().setCustomId('adminpanel:tier_delete_select').setPlaceholder('Select a tier to delete...').addOptions(options),
          ),
          backRow,
        ],
      });
      return;
    }

    if (sub === 'rule_add') {
      const modal = new ModalBuilder()
        .setCustomId('adminpanel:modal:rule_add')
        .setTitle('Add Payment Method');

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('methodName').setLabel('Method Name').setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. BCA, PayPal, USDT, Wise').setRequired(true).setMaxLength(50),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('fee').setLabel('Additional Fee (IDR)').setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. 2500 — enter 0 for no fee').setRequired(true).setMaxLength(15),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('description').setLabel('Description (optional)').setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g. International bank transfer').setRequired(false).setMaxLength(100),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('recommended').setLabel('Recommended? (yes / no)').setStyle(TextInputStyle.Short)
            .setPlaceholder('yes or no').setRequired(true).setMaxLength(3),
        ),
      );

      await interaction.showModal(modal);
      return;
    }

    if (sub === 'rule_edit') {
      const rules = await prisma.paymentFeeRule.findMany({ where: { guildId }, orderBy: { sortOrder: 'asc' } });
      if (rules.length === 0) {
        await interaction.update({
          embeds: [new EmbedBuilder().setColor(Colors.WARNING).setTitle('⚠️ No Rules').setDescription('No payment rules exist. Add one first.')],
          components: [backRow],
        });
        return;
      }

      const options = rules.slice(0, 25).map(r => ({
        label: r.methodName,
        description: `Fee: Rp ${formatIDR(r.fee)}`,
        value: r.id,
      }));

      await interaction.update({
        embeds: [new EmbedBuilder().setColor(Colors.PRIMARY).setTitle('✏️ Select Rule to Edit')],
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder().setCustomId('adminpanel:rule_edit_select').setPlaceholder('Select a rule...').addOptions(options),
          ),
          backRow,
        ],
      });
      return;
    }

    if (sub === 'rule_delete') {
      const rules = await prisma.paymentFeeRule.findMany({ where: { guildId }, orderBy: { sortOrder: 'asc' } });
      if (rules.length === 0) {
        await interaction.update({
          embeds: [new EmbedBuilder().setColor(Colors.WARNING).setTitle('⚠️ No Rules').setDescription('No payment rules to delete.')],
          components: [backRow],
        });
        return;
      }

      const options = rules.slice(0, 25).map(r => ({
        label: r.methodName,
        description: `Fee: Rp ${formatIDR(r.fee)}`,
        value: r.id,
      }));

      await interaction.update({
        embeds: [new EmbedBuilder().setColor(Colors.DANGER).setTitle('🗑️ Select Rule to Delete')],
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder().setCustomId('adminpanel:rule_delete_select').setPlaceholder('Select a rule to delete...').addOptions(options),
          ),
          backRow,
        ],
      });
      return;
    }

    if (sub === 'rule_enabled') {
      // Fresh query — fixes stale-data bug
      const rules = await prisma.paymentFeeRule.findMany({ where: { guildId }, orderBy: { sortOrder: 'asc' } });
      if (rules.length === 0) {
        await interaction.update({
          embeds: [new EmbedBuilder().setColor(Colors.WARNING).setTitle('⚠️ No Methods').setDescription('No payment methods exist. Add one first.')],
          components: [backRow],
        });
        return;
      }
      // Enabled methods first, then disabled
      const sorted = [...rules].sort((a, b) => Number(b.enabled) - Number(a.enabled));
      const options = sorted.slice(0, 25).map(r =>
        new StringSelectMenuOptionBuilder()
          .setLabel(r.methodName)
          .setDescription(r.enabled ? '✅ Currently Enabled' : '❌ Currently Disabled')
          .setValue(r.id)
          .setDefault(r.enabled),
      );
      await interaction.update({
        embeds: [new EmbedBuilder().setColor(Colors.PRIMARY).setTitle('✅ Manage Enabled Methods')
          .setDescription('Select all methods that should be **enabled**. Unselected methods will be **disabled**.\n\nSubmit with nothing selected to disable all.')],
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('adminpanel:rule_enabled_select')
              .setPlaceholder('Select enabled methods...')
              .setMinValues(0)
              .setMaxValues(Math.min(rules.length, 25))
              .addOptions(options),
          ),
          backRow,
        ],
      });
      return;
    }

    if (sub === 'rule_recommend') {
      // Fresh query
      const rules = await prisma.paymentFeeRule.findMany({ where: { guildId }, orderBy: { sortOrder: 'asc' } });
      if (rules.length === 0) {
        await interaction.update({
          embeds: [new EmbedBuilder().setColor(Colors.WARNING).setTitle('⚠️ No Methods').setDescription('No payment methods exist. Add one first.')],
          components: [backRow],
        });
        return;
      }
      // Recommended methods first, then rest
      const sorted = [...rules].sort((a, b) => Number(b.recommended) - Number(a.recommended));
      const options = sorted.slice(0, 25).map(r =>
        new StringSelectMenuOptionBuilder()
          .setLabel(r.methodName)
          .setDescription(r.recommended ? '⭐ Currently Recommended' : 'Not Recommended')
          .setValue(r.id)
          .setDefault(r.recommended),
      );
      await interaction.update({
        embeds: [new EmbedBuilder().setColor(Colors.PRIMARY).setTitle('⭐ Set Recommended Methods')
          .setDescription('Select all methods that should be **recommended**. Unselected methods will be unmarked.\n\nSubmit with nothing selected to clear all recommendations.')],
        components: [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId('adminpanel:rule_recommend_select')
              .setPlaceholder('Select recommended methods...')
              .setMinValues(0)
              .setMaxValues(Math.min(rules.length, 25))
              .addOptions(options),
          ),
          backRow,
        ],
      });
      return;
    }

    if (sub === 'custom_settings') {
      const current = await prisma.guildPaymentSettings.findUnique({ where: { guildId } });
      const modal = new ModalBuilder()
        .setCustomId('adminpanel:modal:custom_settings')
        .setTitle('Custom Payment Method Settings');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('allowCustom').setLabel('Allow Custom Methods? (yes / no)').setStyle(TextInputStyle.Short)
            .setValue(current?.allowCustomPaymentMethods !== false ? 'yes' : 'no').setRequired(true).setMaxLength(3),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('customLabel').setLabel('Custom Method Label').setStyle(TextInputStyle.Short)
            .setValue(current?.customMethodLabel ?? 'Other Payment Method').setRequired(true).setMaxLength(50),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder().setCustomId('customFee').setLabel('Custom Method Fee (IDR)').setStyle(TextInputStyle.Short)
            .setValue(String(current?.customMethodFee ?? 2500)).setRequired(true).setMaxLength(15),
        ),
      );
      await interaction.showModal(modal);
      return;
    }
  }

  // ── Edit tier — user pilih tier mana yang mau diedit, modal udah keisi otomatis
  if (action === 'tier_edit_select' && interaction.isStringSelectMenu()) {
    const tierId = interaction.values[0];
    const tier = await prisma.middlemanFeeTier.findUnique({ where: { id: tierId } });
    if (!tier) { await interaction.update({ content: 'Tier not found.', components: [] }); return; }

    const modal = new ModalBuilder()
      .setCustomId(`adminpanel:modal:tier_edit:${tierId}`)
      .setTitle('Edit Fee Tier');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('minAmount').setLabel('Minimum Amount (IDR)').setStyle(TextInputStyle.Short)
          .setValue(String(tier.minAmount)).setRequired(true).setMaxLength(15),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('maxAmount').setLabel('Maximum Amount (IDR)').setStyle(TextInputStyle.Short)
          .setValue(tier.maxAmount !== null ? String(tier.maxAmount) : '').setRequired(false).setMaxLength(15),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('fee').setLabel('Fee Amount (IDR)').setStyle(TextInputStyle.Short)
          .setValue(String(tier.fee)).setRequired(true).setMaxLength(15),
      ),
    );

    await interaction.showModal(modal);
    return;
  }

  // ── Delete tier — langsung kehapus terus panelnya auto-refresh
  if (action === 'tier_delete_select' && interaction.isStringSelectMenu()) {
    const tierId = interaction.values[0];
    await prisma.middlemanFeeTier.delete({ where: { id: tierId } });
    await interaction.update(await buildPaymentSettingsPayload(guildId));
    return;
  }

  // ── Edit payment method — modal udah otomatis keisi pake data lama
  if (action === 'rule_edit_select' && interaction.isStringSelectMenu()) {
    const ruleId = interaction.values[0];
    const rule = await prisma.paymentFeeRule.findUnique({ where: { id: ruleId } });
    if (!rule) { await interaction.update({ content: 'Rule not found.', components: [] }); return; }

    const modal = new ModalBuilder()
      .setCustomId(`adminpanel:modal:rule_edit:${ruleId}`)
      .setTitle('Edit Payment Method');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('methodName').setLabel('Method Name').setStyle(TextInputStyle.Short)
          .setValue(rule.methodName).setRequired(true).setMaxLength(50),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('fee').setLabel('Additional Fee (IDR)').setStyle(TextInputStyle.Short)
          .setValue(String(rule.fee)).setRequired(true).setMaxLength(15),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('description').setLabel('Description (optional)').setStyle(TextInputStyle.Short)
          .setValue(rule.description ?? '').setRequired(false).setMaxLength(100),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('recommended').setLabel('Recommended? (yes / no)').setStyle(TextInputStyle.Short)
          .setValue(rule.recommended ? 'yes' : 'no').setRequired(true).setMaxLength(3),
      ),
    );

    await interaction.showModal(modal);
    return;
  }

  // ── Delete payment method — langsung hilang terus panelnya auto-refresh
  if (action === 'rule_delete_select' && interaction.isStringSelectMenu()) {
    const ruleId = interaction.values[0];
    await prisma.paymentFeeRule.delete({ where: { id: ruleId } });
    await interaction.update(await buildPaymentSettingsPayload(guildId));
    return;
  }

  // ── Bulk enable/disable payment methods sekaligus
  if (action === 'rule_enabled_select' && interaction.isStringSelectMenu()) {
    const selectedIds = interaction.values;
    await Promise.all([
      selectedIds.length > 0
        ? prisma.paymentFeeRule.updateMany({ where: { guildId, id: { in: selectedIds } },    data: { enabled: true } })
        : Promise.resolve(),
      prisma.paymentFeeRule.updateMany({ where: { guildId, id: { notIn: selectedIds } }, data: { enabled: false } }),
    ]);
    await interaction.update(await buildPaymentSettingsPayload(guildId));
    return;
  }

  // ── Bulk set mana aja yang ⭐ recommended sekaligus
  if (action === 'rule_recommend_select' && interaction.isStringSelectMenu()) {
    const selectedIds = interaction.values;
    await Promise.all([
      selectedIds.length > 0
        ? prisma.paymentFeeRule.updateMany({ where: { guildId, id: { in: selectedIds } },    data: { recommended: true } })
        : Promise.resolve(),
      prisma.paymentFeeRule.updateMany({ where: { guildId, id: { notIn: selectedIds } }, data: { recommended: false } }),
    ]);
    await interaction.update(await buildPaymentSettingsPayload(guildId));
    return;
  }

  // ── User pilih jenis category dulu, abis itu baru muncul channel selectnya
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

  // ── Channel udah dipilih, langsung kesave ke database
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

  // ── User pilih jenis role dulu, abis itu baru muncul role selectnya
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

  // ── Roles udah dipilih, langsung kesave ke database
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

  // ── User pilih jenis log dulu, abis itu baru muncul channel selectnya
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

// ── Handler buat semua button di admin panel

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

  if (action === 'back' && field === 'payment') {
    await interaction.update(await buildPaymentSettingsPayload(guildId));
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

// ── Handler buat semua modal yang di-submit di admin panel

export async function handleModal(interaction: ModalSubmitInteraction) {
  const parts = interaction.customId.split(':');
  if (parts[0] !== 'adminpanel' || parts[1] !== 'modal') return;

  const guildId = interaction.guildId!;
  const guild = await prisma.guild.findUnique({ where: { id: guildId } });
  if (!guild) { await interaction.reply({ content: 'Bot not configured.', ephemeral: true }); return; }

  const member = await interaction.guild!.members.fetch(interaction.user.id);
  if (!canAccessAdminPanel(member, guild)) {
    await interaction.reply({ content: '❌ Permission denied.', ephemeral: true });
    return;
  }

  const modalType = parts[2];
  const entityId  = parts[3];

  if (modalType === 'bankinfo') {
    const bankName      = interaction.fields.getTextInputValue('bankName').trim();
    const accountNumber = interaction.fields.getTextInputValue('accountNumber').trim();
    const accountHolder = interaction.fields.getTextInputValue('accountHolder').trim();
    const qrisImageUrl  = interaction.fields.getTextInputValue('qrisImageUrl').trim() || null;

    await prisma.guildPaymentSettings.upsert({
      where:  { guildId },
      update: { bankName, accountNumber, accountHolder, qrisImageUrl },
      create: { guildId, bankName, accountNumber, accountHolder, qrisImageUrl },
    });

    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await buildPaymentSettingsPayload(guildId));
    return;
  }

  if (modalType === 'tier_add') {
    const minRaw = interaction.fields.getTextInputValue('minAmount').trim().replace(/\D/g, '');
    const maxRaw = interaction.fields.getTextInputValue('maxAmount').trim().replace(/\D/g, '');
    const feeRaw = interaction.fields.getTextInputValue('fee').trim().replace(/\D/g, '');

    const minAmount = parseInt(minRaw, 10);
    const maxAmount = maxRaw ? parseInt(maxRaw, 10) : null;
    const fee       = parseInt(feeRaw, 10);

    if (isNaN(minAmount) || isNaN(fee)) {
      await interaction.reply({ content: '❌ Invalid amounts. Please enter numbers only.', ephemeral: true });
      return;
    }

    const count = await prisma.middlemanFeeTier.count({ where: { guildId } });
    await prisma.middlemanFeeTier.create({ data: { guildId, minAmount, maxAmount, fee, sortOrder: count } });

    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await buildPaymentSettingsPayload(guildId));
    return;
  }

  if (modalType === 'tier_edit' && entityId) {
    const minRaw = interaction.fields.getTextInputValue('minAmount').trim().replace(/\D/g, '');
    const maxRaw = interaction.fields.getTextInputValue('maxAmount').trim().replace(/\D/g, '');
    const feeRaw = interaction.fields.getTextInputValue('fee').trim().replace(/\D/g, '');

    const minAmount = parseInt(minRaw, 10);
    const maxAmount = maxRaw ? parseInt(maxRaw, 10) : null;
    const fee       = parseInt(feeRaw, 10);

    if (isNaN(minAmount) || isNaN(fee)) {
      await interaction.reply({ content: '❌ Invalid amounts. Please enter numbers only.', ephemeral: true });
      return;
    }

    await prisma.middlemanFeeTier.update({ where: { id: entityId }, data: { minAmount, maxAmount, fee } });

    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await buildPaymentSettingsPayload(guildId));
    return;
  }

  if (modalType === 'rule_add') {
    const methodName  = interaction.fields.getTextInputValue('methodName').trim();
    const feeRaw      = interaction.fields.getTextInputValue('fee').trim().replace(/\D/g, '');
    const fee         = parseInt(feeRaw, 10);
    const description = interaction.fields.getTextInputValue('description').trim() || null;
    const recommended = interaction.fields.getTextInputValue('recommended').trim().toLowerCase() === 'yes';

    if (!methodName || isNaN(fee)) {
      await interaction.reply({ content: '❌ Invalid input. Method name and fee are required.', ephemeral: true });
      return;
    }

    const count = await prisma.paymentFeeRule.count({ where: { guildId } });
    await prisma.paymentFeeRule.upsert({
      where:  { guildId_methodName: { guildId, methodName } },
      update: { fee, description, recommended },
      create: { guildId, methodName, fee, description, recommended, enabled: true, sortOrder: count },
    });

    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await buildPaymentSettingsPayload(guildId));
    return;
  }

  if (modalType === 'rule_edit' && entityId) {
    const methodName  = interaction.fields.getTextInputValue('methodName').trim();
    const feeRaw      = interaction.fields.getTextInputValue('fee').trim().replace(/\D/g, '');
    const fee         = parseInt(feeRaw, 10);
    const description = interaction.fields.getTextInputValue('description').trim() || null;
    const recommended = interaction.fields.getTextInputValue('recommended').trim().toLowerCase() === 'yes';

    if (!methodName || isNaN(fee)) {
      await interaction.reply({ content: '❌ Invalid input. Method name and fee are required.', ephemeral: true });
      return;
    }

    await prisma.paymentFeeRule.update({ where: { id: entityId }, data: { methodName, fee, description, recommended } });

    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await buildPaymentSettingsPayload(guildId));
    return;
  }

  if (modalType === 'custom_settings') {
    const allowRaw    = interaction.fields.getTextInputValue('allowCustom').trim().toLowerCase();
    const customLabel = interaction.fields.getTextInputValue('customLabel').trim();
    const feeRaw      = interaction.fields.getTextInputValue('customFee').trim().replace(/\D/g, '');
    const customFee   = parseInt(feeRaw, 10);

    if (!customLabel || isNaN(customFee)) {
      await interaction.reply({ content: '❌ Invalid input. Label and fee are required.', ephemeral: true });
      return;
    }

    const allowCustom = allowRaw === 'yes';
    await prisma.guildPaymentSettings.update({
      where: { guildId },
      data:  { allowCustomPaymentMethods: allowCustom, customMethodLabel: customLabel, customMethodFee: customFee },
    });

    await interaction.deferReply({ ephemeral: true });
    await interaction.editReply(await buildPaymentSettingsPayload(guildId));
    return;
  }
}
