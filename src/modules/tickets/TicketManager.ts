import {
  TextChannel,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalSubmitInteraction,
} from 'discord.js';
import { PrismaClient, TicketType, TicketStatus, Priority } from '@prisma/client';
import { client } from '../../bot/client';
import { TicketCreateOptions, TicketCloseOptions, TicketTransferOptions, TicketEscalateOptions, Colors, TICKET_STATUS_DISPLAY } from '../../types/index';
import { AuditService } from '../../services/AuditService';
import { NotificationService } from '../../services/NotificationService';
import { TranscriptGenerator } from './TranscriptGenerator';
import { priorityBadge, ticketStatusBadge } from '../../utils/formatting';
import { getLocale } from '../../locales';

const prisma = new PrismaClient();

export class TicketManager {
  static async create(options: TicketCreateOptions) {
    const { guildId, creatorId, creatorTag, type, formData, channel } = options;

    const guild = await prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) throw new Error('Guild not configured');

    const count = await prisma.ticket.count({ where: { guildId } });
    const ticketNumber = count + 1;
    const language = (formData as any)?._lang ?? 'en';

    const ticket = await prisma.ticket.create({
      data: {
        guildId,
        channelId: channel.id,
        channelName: channel.name,
        ticketNumber,
        type,
        status: 'OPEN',
        priority: 'NORMAL',
        language,
        creatorId,
        creatorTag,
        formData: formData ?? {},
      },
    });

    const t = getLocale(language);
    const embed = this.buildTicketEmbed(ticket as any, creatorTag, t);
    const row = this.buildTicketButtons(ticket.id, t);

    await channel.send({ embeds: [embed], components: [row] });

    return ticket;
  }

  static async close(options: TicketCloseOptions) {
    const { ticketId, closedById, closedByTag, reason, generateTranscript } = options;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.status === 'CLOSED' || ticket.status === 'ARCHIVED') throw new Error('Ticket already closed');

    let transcriptUrl: string | undefined;
    if (generateTranscript) {
      transcriptUrl = await TranscriptGenerator.generate(ticket.channelId, ticket.guildId, ticket.ticketNumber);
    }

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedById,
        closedByTag,
        closedReason: reason,
        transcriptUrl,
      },
    });

    if (ticket.claimedById) {
      await this.updateStaffStats(ticket.guildId, ticket.claimedById, closedByTag, ticket);
    }

    await NotificationService.notifyTicketClosed(ticketId);

    try {
      const fetched = await client.channels.fetch(ticket.channelId);
      if (!fetched || !fetched.isTextBased() || fetched.isDMBased()) return;
      const channel = fetched as TextChannel;

      await channel.permissionOverwrites.edit(ticket.guildId, { SendMessages: false });

      const t = getLocale((ticket as any).language);

      const embed = new EmbedBuilder()
        .setColor(Colors.NEUTRAL)
        .setTitle(t.close.title)
        .addFields(
          { name: t.close.closedBy, value: `<@${closedById}>`, inline: true },
          { name: t.close.closedAt, value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
          { name: t.close.reason, value: reason ?? t.close.noReason, inline: false },
        )
        .setDescription(t.close.description)
        .setFooter({ text: t.close.footerPrefix + ticketId })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`ticket:reopen:${ticketId}`).setLabel(t.close.reopen).setStyle(ButtonStyle.Success).setEmoji('🔓'),
        new ButtonBuilder().setCustomId(`ticket:move:${ticketId}`).setLabel(t.close.move).setStyle(ButtonStyle.Primary).setEmoji('📂'),
        new ButtonBuilder().setCustomId(`ticket:delete_confirm:${ticketId}`).setLabel(t.close.delete).setStyle(ButtonStyle.Danger).setEmoji('🗑️'),
      );

      await channel.send({ embeds: [embed], components: [row] });
    } catch {
      // Channel inaccessible — nothing to do
    }
  }

  static async claim(ticketId: string, staffId: string, staffTag: string) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.claimedById) throw new Error(`Already claimed by <@${ticket.claimedById}>`);

    const now = new Date();
    const responseTimeSec = Math.floor((now.getTime() - ticket.createdAt.getTime()) / 1000);

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        claimedById: staffId,
        claimedByTag: staffTag,
        status: 'CLAIMED',
        firstResponseAt: ticket.firstResponseAt ?? now,
        responseTimeSec: ticket.responseTimeSec ?? responseTimeSec,
      },
    });

    await AuditService.log({
      guildId: ticket.guildId,
      ticketId,
      actorId: staffId,
      actorTag: staffTag,
      action: 'TICKET_CLAIMED',
    });
  }

  static async transfer(options: TicketTransferOptions) {
    const { ticketId, newStaffId, newStaffTag, transferredById, transferredByTag, reason } = options;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');

    await prisma.ticket.update({
      where: { id: ticketId },
      data: { claimedById: newStaffId, claimedByTag: newStaffTag, status: 'CLAIMED' },
    });

    await AuditService.log({
      guildId: ticket.guildId,
      ticketId,
      actorId: transferredById,
      actorTag: transferredByTag,
      action: 'TICKET_TRANSFERRED',
      oldValue: transferredByTag,
      newValue: newStaffTag,
      reason,
    });
  }

  static async escalate(options: TicketEscalateOptions) {
    const { ticketId, escalatedById, escalatedByTag, reason, newPriority } = options;

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'ESCALATED',
        priority: newPriority ?? 'URGENT',
        claimedById: null,
        claimedByTag: null,
      },
    });

    await AuditService.log({
      guildId: ticket.guildId,
      ticketId,
      actorId: escalatedById,
      actorTag: escalatedByTag,
      action: 'TICKET_ESCALATED',
      newValue: newPriority ?? 'URGENT',
      reason,
    });
  }

  static async setStatus(ticketId: string, status: TicketStatus, actorId: string, actorTag: string) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');

    await prisma.ticket.update({ where: { id: ticketId }, data: { status } });

    await AuditService.log({
      guildId: ticket.guildId,
      ticketId,
      actorId,
      actorTag,
      action: 'STATUS_CHANGED',
      oldValue: ticket.status,
      newValue: status,
    });
  }

  static async setPriority(ticketId: string, priority: Priority, actorId: string, actorTag: string) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');

    await prisma.ticket.update({ where: { id: ticketId }, data: { priority } });

    await AuditService.log({
      guildId: ticket.guildId,
      ticketId,
      actorId,
      actorTag,
      action: 'PRIORITY_CHANGED',
      oldValue: ticket.priority,
      newValue: priority,
    });
  }

  static async reopen(ticketId: string, actorId: string, actorTag: string) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');
    if (ticket.status !== 'CLOSED') throw new Error('Ticket is not closed');

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'OPEN',
        closedAt: null,
        closedById: null,
        closedByTag: null,
        closedReason: null,
        reopenedAt: new Date(),
      },
    });

    await AuditService.log({
      guildId: ticket.guildId,
      ticketId,
      actorId,
      actorTag,
      action: 'TICKET_REOPENED',
    });
  }

  static async addNote(ticketId: string, authorId: string, authorTag: string, content: string) {
    return prisma.staffNote.create({
      data: { ticketId, authorId, authorTag, content },
    });
  }

  static async addParticipant(ticketId: string, userId: string, userTag: string, addedById: string, addedByTag: string) {
    return prisma.ticketParticipant.upsert({
      where: { ticketId_userId: { ticketId, userId } },
      update: {},
      create: { ticketId, userId, userTag, addedById, addedByTag },
    });
  }

  static async removeParticipant(ticketId: string, userId: string) {
    return prisma.ticketParticipant.deleteMany({ where: { ticketId, userId } });
  }

  static getTicketLanguage(ticket: any): string {
    return ticket?.language ?? 'en';
  }

  private static async updateStaffStats(guildId: string, staffId: string, staffTag: string, ticket: { responseTimeSec: number | null }) {
    const responseMs = BigInt((ticket.responseTimeSec ?? 0) * 1000);
    await prisma.staffStats.upsert({
      where: { guildId_userId: { guildId, userId: staffId } },
      update: {
        ticketsClosed: { increment: 1 },
        totalFirstResponseMs: { increment: responseMs },
        firstResponseCount: { increment: ticket.responseTimeSec ? 1 : 0 },
        userTag: staffTag,
      },
      create: {
        guildId,
        userId: staffId,
        userTag: staffTag,
        ticketsClosed: 1,
        totalFirstResponseMs: responseMs,
        firstResponseCount: ticket.responseTimeSec ? 1 : 0,
      },
    });
  }

  static buildTicketEmbed(ticket: any, creatorTag: string, t = getLocale('en')): EmbedBuilder {
    const statusDisplay = TICKET_STATUS_DISPLAY[ticket.status as TicketStatus];
    const formEntries = ticket.formData
      ? Object.entries(ticket.formData as Record<string, string>)
          .filter(([k]) => !k.startsWith('_'))
          .map(([k, v]) => `**${k}:** ${v}`)
          .join('\n')
          .slice(0, 1024)
      : null;

    return new EmbedBuilder()
      .setColor(statusDisplay.color)
      .setTitle(`${statusDisplay.emoji} Ticket #${ticket.ticketNumber} — ${ticket.type.replace(/_/g, ' ')}`)
      .addFields(
        { name: t.ticketEmbed.createdBy, value: `<@${ticket.creatorId}> (${creatorTag})`, inline: true },
        { name: t.ticketEmbed.status, value: ticketStatusBadge(ticket.status), inline: true },
        { name: t.ticketEmbed.priority, value: priorityBadge(ticket.priority), inline: true },
        ...(formEntries ? [{ name: t.ticketEmbed.details, value: formEntries }] : []),
      )
      .setFooter({ text: `Ticket ID: ${ticket.id}` })
      .setTimestamp();
  }

  static buildTicketButtons(ticketId: string, t = getLocale('en')): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`ticket:claim:${ticketId}`).setLabel(t.ticketEmbed.claim).setStyle(ButtonStyle.Primary).setEmoji('🙋'),
      new ButtonBuilder().setCustomId(`ticket:close:${ticketId}`).setLabel(t.ticketEmbed.close).setStyle(ButtonStyle.Danger).setEmoji('🔒'),
      new ButtonBuilder().setCustomId(`ticket:note:${ticketId}`).setLabel(t.ticketEmbed.addNote).setStyle(ButtonStyle.Secondary).setEmoji('📝'),
    );
  }

  async createTicket(
    opts: { guildId: string; userId: string; userTag: string; type: TicketType; formData: Record<string, string> },
    interaction: ModalSubmitInteraction,
  ): Promise<void> {
    const { TicketWorkflow } = await import('./TicketWorkflow.js');
    const member = await interaction.guild!.members.fetch(opts.userId);
    const result = await TicketWorkflow.openTicket(interaction.guild!, member, opts.type, opts.formData);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: result.message, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: result.message, ephemeral: true }).catch(() => {});
    }
  }
}
