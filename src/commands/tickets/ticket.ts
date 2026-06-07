import {
  SlashCommandBuilder,
  ButtonInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { TicketWorkflow } from '../../modules/tickets/TicketWorkflow';
import { TicketManager } from '../../modules/tickets/TicketManager';
import { TranscriptGenerator } from '../../modules/tickets/TranscriptGenerator';
import { TICKET_FORMS } from '../../types/index';
import { prisma } from '../../utils/prisma';
import { client } from '../../bot/client';
import { TicketType } from '@prisma/client';
import { logger } from '../../utils/logger';
import {
  canCloseTicket,
  canReopenTicket,
  canClaimTicket,
  canDeleteTicket,
  canMoveTicket,
  canEscalateTicket,
} from '../../utils/permissions';
import { PAYMENT_METHODS } from '../../utils/paymentFee';
import {
  setPendingMiddleman,
  takePendingMiddleman,
  peekPendingMiddleman,
} from '../../utils/pendingMiddlemanCache';
import { getLocale, type SupportedLocale } from '../../locales';
import { Colors } from '../../types';

export const data = new SlashCommandBuilder()
  .setName('ticket')
  .setDescription('Ticket system (internal — used by panel buttons)');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.editReply({ content: 'Use the ticket panel buttons to open a ticket.' });
}

export async function handleButton(interaction: ButtonInteraction) {
  const parts = interaction.customId.split(':');
  const action = parts[1];

  // ── Panel open buttons: ticket:open:TYPE:lang ─────────────────────────────
  if (action === 'open') {
    const type = parts[2] as TicketType;
    const lang = (parts[3] ?? 'en') as SupportedLocale;
    const t = getLocale(lang);

    if (type === 'MIDDLEMAN') {
      const fields = TICKET_FORMS['MIDDLEMAN'];
      const modal = new ModalBuilder()
        .setCustomId(`ticket:modal:MIDDLEMAN:${lang}`)
        .setTitle('Open Middleman Ticket');

      const rows = fields.slice(0, 5).map(f =>
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId(f.id)
            .setLabel(f.label)
            .setPlaceholder(f.placeholder ?? '')
            .setRequired(f.required)
            .setStyle(f.style === 'PARAGRAPH' ? TextInputStyle.Paragraph : TextInputStyle.Short)
            .setMinLength(f.minLength ?? 0)
            .setMaxLength(f.maxLength ?? 1000),
        )
      );
      modal.addComponents(...rows);
      await interaction.showModal(modal);
      return;
    }

    if (type === 'SUPPORT') {
      const modal = new ModalBuilder()
        .setCustomId(`ticket:modal:SUPPORT:${lang}`)
        .setTitle(t.modal.supportTitle);

      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('subject')
            .setLabel(t.modal.subject)
            .setPlaceholder(t.modal.subjectPlaceholder)
            .setRequired(true)
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel(t.modal.description)
            .setPlaceholder(t.modal.descriptionPlaceholder)
            .setRequired(true)
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(20)
            .setMaxLength(1000),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('attempted')
            .setLabel(t.modal.attempted)
            .setPlaceholder(t.modal.attemptedPlaceholder)
            .setRequired(false)
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500),
        ),
      );
      await interaction.showModal(modal);
      return;
    }

    await interaction.reply({ content: 'Unknown ticket type.', ephemeral: true });
    return;
  }

  // ── In-ticket action buttons ──────────────────────────────────────────────
  const ticketId = parts[2];
  if (!ticketId) {
    await interaction.reply({ content: 'Invalid button.', ephemeral: true });
    return;
  }

  const guildConfig = await prisma.guild.findUnique({ where: { id: interaction.guildId! } });
  if (!guildConfig) {
    await interaction.reply({ content: 'Bot is not configured for this server.', ephemeral: true });
    return;
  }
  const member = await interaction.guild!.members.fetch(interaction.user.id);

  if (action === 'claim') {
    if (!canClaimTicket(member, guildConfig)) {
      await interaction.reply({ content: '❌ Only staff can claim tickets.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    await TicketManager.claim(ticketId, interaction.user.id, interaction.user.tag);
    await interaction.editReply({ content: 'You have claimed this ticket.' });
    return;
  }

  if (action === 'close') {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) { await interaction.reply({ content: 'Ticket not found.', ephemeral: true }); return; }
    if (!canCloseTicket(member, guildConfig, ticket.creatorId)) {
      await interaction.reply({ content: '❌ You do not have permission to close this ticket.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    await TicketManager.close({
      ticketId,
      closedById: interaction.user.id,
      closedByTag: interaction.user.tag,
      reason: 'Closed via button',
      generateTranscript: false,
    });
    await interaction.editReply({ content: 'Ticket closed.' });
    return;
  }

  if (action === 'reopen') {
    if (!canReopenTicket(member, guildConfig)) {
      await interaction.reply({ content: '❌ Only staff can reopen tickets.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) { await interaction.editReply({ content: 'Ticket not found.' }); return; }

    await TicketManager.reopen(ticketId, interaction.user.id, interaction.user.tag);

    try {
      const fetched = await client.channels.fetch(ticket.channelId);
      if (fetched && fetched.isTextBased() && !fetched.isDMBased()) {
        const ch = fetched as import('discord.js').TextChannel;
        await ch.permissionOverwrites.edit(ticket.guildId, { SendMessages: null });
      }
    } catch {}

    await interaction.editReply({ content: '🔓 Ticket reopened.' });
    return;
  }

  if (action === 'note') {
    if (!canClaimTicket(member, guildConfig)) {
      await interaction.reply({ content: '❌ Only staff can add notes.', ephemeral: true });
      return;
    }
    const modal = new ModalBuilder()
      .setCustomId(`ticket:note:${ticketId}`)
      .setTitle('Add Staff Note')
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('note_content')
            .setLabel('Note')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000),
        )
      );
    await interaction.showModal(modal);
    return;
  }

  if (action === 'escalate') {
    if (!canEscalateTicket(member, guildConfig)) {
      await interaction.reply({ content: '❌ Only staff can escalate tickets.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    await TicketManager.escalate({
      ticketId,
      escalatedById: interaction.user.id,
      escalatedByTag: interaction.user.tag,
      reason: 'Escalated via button',
    });
    await interaction.editReply({ content: 'Ticket escalated.' });
    return;
  }

  if (action === 'move') {
    if (!canMoveTicket(member, guildConfig)) {
      await interaction.reply({ content: '❌ Only staff can move tickets.', ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    const allChannels = await guild.channels.fetch();
    const categories = allChannels.filter(c => c !== null && c!.type === ChannelType.GuildCategory);

    if (categories.size === 0) {
      await interaction.editReply({ content: 'No categories found in this server.' });
      return;
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    const ticketChannel = ticket ? await guild.channels.fetch(ticket.channelId).catch(() => null) : null;
    const currentParentId = ticketChannel && 'parentId' in ticketChannel ? ticketChannel.parentId : null;

    const options = categories
      .filter(c => c!.id !== currentParentId)
      .map(c => ({ label: c!.name, value: `${ticketId}:${c!.id}` }))
      .slice(0, 25);

    if (options.length === 0) {
      await interaction.editReply({ content: 'No other categories to move this ticket to.' });
      return;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('ticket:move_select')
      .setPlaceholder('Select destination category...')
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.editReply({ content: '📂 Select a destination category:', components: [row] });
    return;
  }

  if (action === 'funds_received') {
    if (!canClaimTicket(member, guildConfig)) {
      await interaction.reply({ content: '❌ Only staff can confirm funds received.', ephemeral: true });
      return;
    }
    await interaction.deferUpdate();

    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:funds_received:${ticketId}`)
        .setLabel('Funds Received')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🟢')
        .setDisabled(true),
    );

    const receivedAt = Math.floor(Date.now() / 1000);
    const originalEmbeds = interaction.message.embeds;

    const updatedEmbeds = originalEmbeds.map((e, i) => {
      if (i !== 1) return EmbedBuilder.from(e);
      const rebuilt = EmbedBuilder.from(e);
      const fields = e.fields.map(f =>
        f.name === '📊 Status'
          ? { name: '📊 Status', value: '✅ Funds Received', inline: false }
          : f,
      );
      rebuilt.setFields(fields);
      rebuilt.addFields(
        { name: '✅ Received By', value: `<@${interaction.user.id}>`, inline: true },
        { name: '🕐 Received At', value: `<t:${receivedAt}:F>`, inline: true },
      );
      rebuilt.setColor(0x57f287);
      return rebuilt;
    });

    await interaction.editReply({ embeds: updatedEmbeds, components: [disabledRow] });

    const ch = interaction.channel;
    if (ch && !ch.isDMBased() && 'send' in ch) {
      await (ch as import('discord.js').TextChannel).send({
        content: `✅ Funds have been received and verified by <@${interaction.user.id}>.\n\nThe transaction may now proceed.`,
      }).catch(() => {});
    }
    return;
  }

  if (action === 'delete_confirm') {
    if (!canDeleteTicket(member, guildConfig)) {
      await interaction.reply({ content: '❌ Only admins can delete tickets.', ephemeral: true });
      return;
    }
    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`ticket:delete:${ticketId}`).setLabel('Confirm Delete').setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
      new ButtonBuilder().setCustomId(`ticket:delete_cancel:${ticketId}`).setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    );

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('⚠️ Are you sure?')
      .setDescription('This will permanently delete the ticket channel.\n\nA transcript will be saved to the log channel if one is configured.\n\n**This action cannot be undone.**');

    await interaction.reply({ embeds: [embed], components: [confirmRow], ephemeral: true });
    return;
  }

  if (action === 'delete_cancel') {
    await interaction.update({ content: 'Deletion cancelled.', embeds: [], components: [] });
    return;
  }

  if (action === 'delete') {
    await interaction.deferUpdate();

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) { await interaction.editReply({ content: 'Ticket not found.', embeds: [], components: [] }); return; }

    try {
      const guild = await prisma.guild.findUnique({ where: { id: ticket.guildId } });
      if (guild?.logChannelId) {
        const transcript = await TranscriptGenerator.generateBuffer(ticket.channelId, ticket.guildId, ticket.ticketNumber);
        const logChannel = await client.channels.fetch(guild.logChannelId).catch(() => null);
        if (logChannel?.isTextBased() && !logChannel.isDMBased()) {
          const embed = new EmbedBuilder()
            .setColor(0x1abc9c)
            .setTitle('🧾 Ticket Deleted')
            .addFields(
              { name: 'Ticket', value: `#${ticket.ticketNumber} — ${ticket.type.replace(/_/g, ' ')}`, inline: true },
              { name: 'Deleted By', value: `<@${interaction.user.id}>`, inline: true },
              { name: 'Deleted At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
              { name: 'Transcript', value: transcript ? 'Attached below.' : 'Could not generate transcript.' },
            )
            .setTimestamp();

          const files = transcript
            ? [{ attachment: transcript.buffer, name: transcript.filename }]
            : [];

          await (logChannel as import('discord.js').TextChannel).send({ embeds: [embed], files });
        }
      }
    } catch (err) {
      logger.error('[Ticket] Transcript upload failed', err);
    }

    try {
      const fetched = await client.channels.fetch(ticket.channelId);
      if (fetched) await fetched.delete();
    } catch {}

    await prisma.ticket.update({ where: { id: ticketId }, data: { status: 'ARCHIVED' } });
    await interaction.editReply({ content: '🗑️ Ticket deleted.', embeds: [], components: [] });
    return;
  }

  await interaction.reply({ content: 'Unknown action.', ephemeral: true });
}

export async function handleSelect(interaction: StringSelectMenuInteraction) {
  // ── Language selection from panel → show ticket type buttons ─────────────
  if (interaction.customId === 'ticket:lang_select') {
    const lang = interaction.values[0] as SupportedLocale;
    const t = getLocale(lang);

    const embed = new EmbedBuilder()
      .setTitle('🎫 ' + t.panel.title)
      .setDescription(t.panel.description)
      .setColor(Colors.PRIMARY);

    const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:open:MIDDLEMAN:${lang}`)
        .setLabel(t.ticketTypes.middleman.label)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`ticket:open:SUPPORT:${lang}`)
        .setLabel(t.ticketTypes.tickets.label)
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [btnRow], ephemeral: true });
    return;
  }

  // ── Move ticket: category select ──────────────────────────────────────────
  if (interaction.customId === 'ticket:move_select') {
    await interaction.deferUpdate();

    const [ticketId, categoryId] = interaction.values[0].split(':');
    if (!ticketId || !categoryId) {
      await interaction.editReply({ content: 'Invalid selection.', components: [] });
      return;
    }

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) {
      await interaction.editReply({ content: 'Ticket not found.', components: [] });
      return;
    }

    try {
      const fetched = await client.channels.fetch(ticket.channelId);
      if (!fetched || !('setParent' in fetched)) {
        await interaction.editReply({ content: 'Could not find ticket channel.', components: [] });
        return;
      }

      const category = await interaction.guild!.channels.fetch(categoryId);
      await (fetched as import('discord.js').TextChannel).setParent(categoryId, { lockPermissions: false });

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('✅ Ticket Moved')
        .addFields({ name: 'Destination', value: category?.name ?? categoryId });

      await interaction.editReply({ embeds: [embed], components: [] });
    } catch {
      await interaction.editReply({ content: 'Failed to move ticket. Check bot permissions.', components: [] });
    }
    return;
  }

  // ── Middleman: payment-method picker ──────────────────────────────────────
  if (interaction.customId === 'ticket:payment_method') {
    const code = interaction.values[0];

    if (code === 'OTHER_BANK') {
      if (!peekPendingMiddleman(interaction.guildId!, interaction.user.id)) {
        await interaction.update({
          content: '⏰ Your middleman request expired. Please open a new ticket from the panel.',
          embeds: [],
          components: [],
        });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('ticket:other_bank')
        .setTitle('Bank Name')
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('bank_name')
              .setLabel('Which bank will the buyer use?')
              .setPlaceholder('e.g. Mandiri, BRI, BNI, CIMB, SeaBank, Jago')
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
              .setMinLength(2)
              .setMaxLength(50),
          ),
        );

      await interaction.showModal(modal);
      return;
    }

    const formData = takePendingMiddleman(interaction.guildId!, interaction.user.id);
    if (!formData) {
      await interaction.update({
        content: '⏰ Your middleman request expired. Please open a new ticket from the panel.',
        embeds: [],
        components: [],
      });
      return;
    }

    formData.payment_method_code = code;

    await interaction.update({ content: '⏳ Creating your middleman ticket...', embeds: [], components: [] });

    const member = await interaction.guild!.members.fetch(interaction.user.id);
    const lang = (formData._lang as SupportedLocale) ?? 'en';
    const t = getLocale(lang);
    const result = await TicketWorkflow.openTicket(interaction.guild!, member, 'MIDDLEMAN', formData);

    if (!result.success || !result.channelId) {
      await interaction.editReply({ content: result.message });
      return;
    }

    await interaction.editReply({ content: t.ticket.created(result.channelId) });
    setTimeout(() => { interaction.deleteReply().catch(() => {}); }, 5_000);
    return;
  }
}

export async function handleModal(interaction: ModalSubmitInteraction) {
  const parts = interaction.customId.split(':');
  const action = parts[1];

  if (action === 'modal') {
    const type = parts[2] as TicketType;
    // parts[3] is the language code, falls back to 'en'
    const lang = (parts[3] ?? 'en') as SupportedLocale;
    const t = getLocale(lang);

    const fields = TICKET_FORMS[type] ?? [];
    const formData: Record<string, string> = {};
    for (const field of fields.slice(0, 5)) {
      formData[field.id] = interaction.fields.getTextInputValue(field.id);
    }
    // store language for downstream use
    formData._lang = lang;

    if (type === 'MIDDLEMAN') {
      setPendingMiddleman(interaction.guildId!, interaction.user.id, formData);

      const select = new StringSelectMenuBuilder()
        .setCustomId('ticket:payment_method')
        .setPlaceholder('Choose how the buyer will pay...')
        .addOptions(
          PAYMENT_METHODS.map(m => ({
            label: m.label,
            value: m.code,
            description: m.description,
            emoji: m.emoji,
          })),
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

      const intro = new EmbedBuilder()
        .setColor(0xf0b132)
        .setTitle('💳 Select Payment Method')
        .setDescription(
          'Choose the payment method the **buyer** will use. The fee is added on top of the existing middleman fee.',
        )
        .addFields(
          { name: '🏦 BCA / OVO / ShopeePay / DANA', value: 'No additional fee', inline: true },
          { name: '🟢 GoPay / 🔴 LinkAja',           value: '+ Rp 1.000',        inline: true },
          { name: '🏛️ Other Bank',                   value: '+ Rp 2.500',        inline: true },
        )
        .setFooter({ text: 'Fees are calculated server-side and cannot be changed by users.' });

      await interaction.reply({ embeds: [intro], components: [row], ephemeral: true });
      return;
    }

    // SUPPORT (and any other types opened via this flow)
    await interaction.deferReply({ ephemeral: true });
    const member = await interaction.guild!.members.fetch(interaction.user.id);
    const result = await TicketWorkflow.openTicket(interaction.guild!, member, type, formData);

    if (!result.success || !result.channelId) {
      await interaction.editReply({ content: result.message });
      return;
    }

    await interaction.editReply({ content: t.ticket.created(result.channelId) });
    setTimeout(() => { interaction.deleteReply().catch(() => {}); }, 5_000);
    return;
  }

  if (action === 'note') {
    const ticketId = parts[2];
    const content = interaction.fields.getTextInputValue('note_content');
    await interaction.deferReply({ ephemeral: true });
    await TicketManager.addNote(ticketId, interaction.user.id, interaction.user.tag, content);
    await interaction.editReply({ content: 'Note added.' });
    return;
  }

  if (action === 'other_bank') {
    const bankName = interaction.fields.getTextInputValue('bank_name').trim();

    const formData = takePendingMiddleman(interaction.guildId!, interaction.user.id);
    if (!formData) {
      await interaction.reply({
        content: '⏰ Your middleman request expired. Please open a new ticket from the panel.',
        ephemeral: true,
      });
      return;
    }

    if (!bankName) {
      await interaction.reply({
        content: '❌ Bank name is required when "Other Bank" is selected.',
        ephemeral: true,
      });
      return;
    }

    formData.payment_method_code = 'OTHER_BANK';
    formData.payment_method_bank = bankName;

    await interaction.deferReply({ ephemeral: true });
    const member = await interaction.guild!.members.fetch(interaction.user.id);
    const lang = (formData._lang as SupportedLocale) ?? 'en';
    const t = getLocale(lang);
    const result = await TicketWorkflow.openTicket(interaction.guild!, member, 'MIDDLEMAN', formData);

    if (!result.success || !result.channelId) {
      await interaction.editReply({ content: result.message });
      return;
    }

    await interaction.editReply({ content: t.ticket.created(result.channelId) });
    setTimeout(() => { interaction.deleteReply().catch(() => {}); }, 5_000);
    return;
  }

  await interaction.reply({ content: 'Unknown modal.', ephemeral: true });
}
