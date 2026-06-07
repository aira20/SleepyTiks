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

// Helper: fetch ticket language from DB, default to 'en'
async function ticketLang(ticketId: string): Promise<string> {
  const t = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { language: true } });
  return (t as any)?.language ?? 'en';
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

  const lang = await ticketLang(ticketId);
  const t = getLocale(lang);

  const guildConfig = await prisma.guild.findUnique({ where: { id: interaction.guildId! } });
  if (!guildConfig) {
    await interaction.reply({ content: 'Bot is not configured for this server.', ephemeral: true });
    return;
  }
  const member = await interaction.guild!.members.fetch(interaction.user.id);

  if (action === 'claim') {
    if (!canClaimTicket(member, guildConfig)) {
      await interaction.reply({ content: t.ticket.noPermClaim, ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    await TicketManager.claim(ticketId, interaction.user.id, interaction.user.tag);
    await interaction.editReply({ content: t.ticket.claimed });
    return;
  }

  if (action === 'close') {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) { await interaction.reply({ content: t.ticket.ticketNotFound, ephemeral: true }); return; }
    if (!canCloseTicket(member, guildConfig, ticket.creatorId)) {
      await interaction.reply({ content: t.ticket.noPermClose, ephemeral: true });
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
    await interaction.editReply({ content: t.ticket.closed });
    return;
  }

  if (action === 'reopen') {
    if (!canReopenTicket(member, guildConfig)) {
      await interaction.reply({ content: t.ticket.noPermReopen, ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) { await interaction.editReply({ content: t.ticket.ticketNotFound }); return; }

    await TicketManager.reopen(ticketId, interaction.user.id, interaction.user.tag);

    try {
      const fetched = await client.channels.fetch(ticket.channelId);
      if (fetched && fetched.isTextBased() && !fetched.isDMBased()) {
        const ch = fetched as import('discord.js').TextChannel;
        await ch.permissionOverwrites.edit(ticket.guildId, { SendMessages: null });
      }
    } catch {}

    await interaction.editReply({ content: t.ticket.reopened });
    return;
  }

  if (action === 'note') {
    if (!canClaimTicket(member, guildConfig)) {
      await interaction.reply({ content: t.ticket.noPermNote, ephemeral: true });
      return;
    }
    const modal = new ModalBuilder()
      .setCustomId(`ticket:note:${ticketId}`)
      .setTitle(t.ticketEmbed.noteModalTitle)
      .addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('note_content')
            .setLabel(t.ticketEmbed.noteLabel)
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
      await interaction.reply({ content: t.ticket.noPermEscalate, ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    await TicketManager.escalate({
      ticketId,
      escalatedById: interaction.user.id,
      escalatedByTag: interaction.user.tag,
      reason: 'Escalated via button',
    });
    await interaction.editReply({ content: t.ticket.escalated });
    return;
  }

  if (action === 'move') {
    if (!canMoveTicket(member, guildConfig)) {
      await interaction.reply({ content: t.ticket.noPermMove, ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });

    const guild = interaction.guild!;
    const allChannels = await guild.channels.fetch();
    const categories = allChannels.filter(c => c !== null && c!.type === ChannelType.GuildCategory);

    if (categories.size === 0) {
      await interaction.editReply({ content: t.ticket.moveNoCategories });
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
      await interaction.editReply({ content: t.ticket.moveNoOther });
      return;
    }

    const select = new StringSelectMenuBuilder()
      .setCustomId('ticket:move_select')
      .setPlaceholder(t.ticket.movePlaceholder)
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.editReply({ content: t.ticket.moveSelectPrompt, components: [row] });
    return;
  }

  if (action === 'funds_received') {
    if (!canClaimTicket(member, guildConfig)) {
      await interaction.reply({ content: t.ticket.noPermFunds, ephemeral: true });
      return;
    }
    await interaction.deferUpdate();

    const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:funds_received:${ticketId}`)
        .setLabel(t.middleman.fundsButton)
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
        f.name === t.middleman.status
          ? { name: t.middleman.status, value: t.middleman.fundsReceived, inline: false }
          : f,
      );
      rebuilt.setFields(fields);
      rebuilt.addFields(
        { name: t.middleman.fundsReceivedBy, value: `<@${interaction.user.id}>`, inline: true },
        { name: t.middleman.fundsReceivedAt, value: `<t:${receivedAt}:F>`, inline: true },
      );
      rebuilt.setColor(0x57f287);
      return rebuilt;
    });

    await interaction.editReply({ embeds: updatedEmbeds, components: [disabledRow] });

    const ch = interaction.channel;
    if (ch && !ch.isDMBased() && 'send' in ch) {
      await (ch as import('discord.js').TextChannel).send({
        content: t.middleman.fundsConfirmed(interaction.user.id),
      }).catch(() => {});
    }
    return;
  }

  if (action === 'delete_confirm') {
    if (!canDeleteTicket(member, guildConfig)) {
      await interaction.reply({ content: t.ticket.noPermDelete, ephemeral: true });
      return;
    }
    const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`ticket:delete:${ticketId}`).setLabel(t.delete.confirmButton).setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
      new ButtonBuilder().setCustomId(`ticket:delete_cancel:${ticketId}`).setLabel(t.delete.cancelButton).setStyle(ButtonStyle.Secondary),
    );

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle(t.delete.confirmTitle)
      .setDescription(t.delete.confirmDescription);

    await interaction.reply({ embeds: [embed], components: [confirmRow], ephemeral: true });
    return;
  }

  if (action === 'delete_cancel') {
    await interaction.update({ content: t.ticket.deletionCancelled, embeds: [], components: [] });
    return;
  }

  if (action === 'delete') {
    await interaction.deferUpdate();

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) { await interaction.editReply({ content: t.ticket.ticketNotFound, embeds: [], components: [] }); return; }

    try {
      const guild = await prisma.guild.findUnique({ where: { id: ticket.guildId } });
      if (guild?.logChannelId) {
        const transcript = await TranscriptGenerator.generateBuffer(ticket.channelId, ticket.guildId, ticket.ticketNumber);
        const logChannel = await client.channels.fetch(guild.logChannelId).catch(() => null);
        if (logChannel?.isTextBased() && !logChannel.isDMBased()) {
          const embed = new EmbedBuilder()
            .setColor(0x1abc9c)
            .setTitle(t.delete.logTitle)
            .addFields(
              { name: t.delete.logTicket, value: `#${ticket.ticketNumber} — ${ticket.type.replace(/_/g, ' ')}`, inline: true },
              { name: t.delete.logDeletedBy, value: `<@${interaction.user.id}>`, inline: true },
              { name: t.delete.logDeletedAt, value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false },
              { name: t.delete.logTranscript, value: transcript ? t.delete.logTranscriptAttached : t.delete.logTranscriptFailed },
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
    await interaction.editReply({ content: t.delete.deleted, embeds: [], components: [] });
    return;
  }

  await interaction.reply({ content: t.ticket.unknownAction, ephemeral: true });
}

export async function handleSelect(interaction: StringSelectMenuInteraction) {
  // ── Language selection from panel → show ticket type buttons ─────────────
  if (interaction.customId === 'ticket:lang_select') {
    const lang = interaction.values[0] as SupportedLocale;
    const t = getLocale(lang);

    const embed = new EmbedBuilder()
      .setTitle('🎫 ' + t.panel.title)
      .setDescription(t.panel.selectType)
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

    const t = getLocale((ticket as any).language ?? 'en');

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
        .setTitle(t.ticket.moveSuccess)
        .addFields({ name: t.ticket.moveDestination, value: category?.name ?? categoryId });

      await interaction.editReply({ embeds: [embed], components: [] });
    } catch {
      await interaction.editReply({ content: t.ticket.moveFailed, components: [] });
    }
    return;
  }

  // ── Middleman: payment-method picker ──────────────────────────────────────
  if (interaction.customId === 'ticket:payment_method') {
    const code = interaction.values[0];
    const pending = peekPendingMiddleman(interaction.guildId!, interaction.user.id);
    const lang = (pending?._lang ?? 'en') as SupportedLocale;
    const t = getLocale(lang);

    if (code === 'OTHER_BANK') {
      if (!pending) {
        await interaction.update({ content: t.ticket.expiredMiddleman, embeds: [], components: [] });
        return;
      }

      const modal = new ModalBuilder()
        .setCustomId('ticket:other_bank')
        .setTitle(t.middleman.bankModalTitle)
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId('bank_name')
              .setLabel(t.middleman.bankLabel)
              .setPlaceholder(t.middleman.bankPlaceholder)
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
      await interaction.update({ content: t.ticket.expiredMiddleman, embeds: [], components: [] });
      return;
    }

    formData.payment_method_code = code;

    await interaction.update({ content: t.ticket.creatingMiddleman, embeds: [], components: [] });

    const member = await interaction.guild!.members.fetch(interaction.user.id);
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
    const lang = (parts[3] ?? 'en') as SupportedLocale;
    const t = getLocale(lang);

    const fields = TICKET_FORMS[type] ?? [];
    const formData: Record<string, string> = {};
    for (const field of fields.slice(0, 5)) {
      try { formData[field.id] = interaction.fields.getTextInputValue(field.id); } catch {}
    }
    // For SUPPORT the modal fields are custom — read them directly
    if (type === 'SUPPORT') {
      try { formData['subject'] = interaction.fields.getTextInputValue('subject'); } catch {}
      try { formData['description'] = interaction.fields.getTextInputValue('description'); } catch {}
      try { formData['attempted'] = interaction.fields.getTextInputValue('attempted'); } catch {}
    }
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
        .setTitle(t.middleman.selectPaymentTitle)
        .setDescription(t.middleman.selectPaymentDescription)
        .addFields(
          { name: '🏦 BCA / OVO / ShopeePay / DANA', value: t.middleman.feeNone,      inline: true },
          { name: '🟢 GoPay / 🔴 LinkAja',           value: t.middleman.feeGopay,     inline: true },
          { name: '🏛️ Other Bank',                   value: t.middleman.feeOtherBank, inline: true },
        )
        .setFooter({ text: t.middleman.feeFooter });

      await interaction.reply({ embeds: [intro], components: [row], ephemeral: true });
      return;
    }

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
    const lang = await ticketLang(ticketId);
    await interaction.editReply({ content: getLocale(lang).ticket.noteAdded });
    return;
  }

  if (action === 'other_bank') {
    const formData = takePendingMiddleman(interaction.guildId!, interaction.user.id);
    const lang = (formData?._lang ?? 'en') as SupportedLocale;
    const t = getLocale(lang);

    if (!formData) {
      await interaction.reply({ content: t.ticket.expiredMiddleman, ephemeral: true });
      return;
    }

    const bankName = interaction.fields.getTextInputValue('bank_name').trim();
    if (!bankName) {
      await interaction.reply({ content: t.ticket.bankNameRequired, ephemeral: true });
      return;
    }

    formData.payment_method_code = 'OTHER_BANK';
    formData.payment_method_bank = bankName;

    await interaction.deferReply({ ephemeral: true });
    const member = await interaction.guild!.members.fetch(interaction.user.id);
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
