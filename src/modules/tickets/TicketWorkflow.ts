import {
  Guild as DiscordGuild,
  TextChannel,
  PermissionFlagsBits,
  ChannelType,
  GuildMember,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { PrismaClient, TicketType, Guild } from '@prisma/client';
import { TicketManager } from './TicketManager';
import { AccountAnalyzer } from '../antiscam/AccountAnalyzer';
import { PatternDetector } from '../antiscam/PatternDetector';
import { logger } from '../../utils/logger';
import { LIMITS } from '../../config/constants';
import { Colors } from '../../types/index';
import {
  parseIDRAmount,
  validateIDRAmount,
  parseFeeResponsibility,
  calculateMiddlemanFee,
  formatIDR,
  type FeeResponsibility,
} from '../../utils/middlemanFee';

const prisma = new PrismaClient();

function resolveCategoryId(guild: Guild, type: TicketType): string | null {
  switch (type) {
    case 'PURCHASE':
    case 'REFUND':
    case 'SERVICE_REQUEST':
    case 'SELLER_APPLICATION':
      return guild.purchaseCategoryId;
    case 'MIDDLEMAN':
      return guild.middlemanCategoryId;
    case 'APPEAL':
    case 'STAFF_APPLICATION':
      return guild.appealCategoryId;
    case 'PARTNERSHIP':
      return guild.partnerCategoryId;
    case 'REPORT':
      return guild.reportCategoryId;
    case 'SUPPORT':
    case 'CUSTOM':
    default:
      return guild.supportCategoryId;
  }
}

/**
 * Resolves a guild member from a snowflake ID or username.
 * Uses fetch (not cache) to work correctly after bot restarts.
 */
async function resolveParticipant(
  discordGuild: DiscordGuild,
  input: string,
): Promise<GuildMember | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d{15,20}$/.test(trimmed)) {
    try {
      return await discordGuild.members.fetch(trimmed);
    } catch {
      return null;
    }
  }

  try {
    const members = await discordGuild.members.search({ query: trimmed, limit: 5 });
    const match = members.find(
      m =>
        m.user.username.toLowerCase() === trimmed.toLowerCase() ||
        m.displayName.toLowerCase() === trimmed.toLowerCase(),
    );
    return match ?? null;
  } catch {
    return null;
  }
}

export interface MiddlemanParticipants {
  buyer: GuildMember | null;
  seller: GuildMember | null;
  buyerInput: string;
  sellerInput: string;
  warnings: string[];
  amount: number;
  feeResponsibility: FeeResponsibility;
}

async function resolveMiddlemanParticipants(
  discordGuild: DiscordGuild,
  formData: Record<string, string>,
): Promise<MiddlemanParticipants | { validationError: string }> {
  const buyerInput = formData['buyer_id']?.trim() ?? '';
  const sellerInput = formData['seller_id']?.trim() ?? '';

  if (!buyerInput || !sellerInput) {
    return { validationError: 'Both Buyer and Seller fields are required.' };
  }

  // ── Amount validation ───────────────────────────────────────────────────────
  const rawAmount = formData['amount']?.trim() ?? '';
  if (!rawAmount) return { validationError: 'Transaction Amount is required.' };

  const parsedAmount = parseIDRAmount(rawAmount);
  if (parsedAmount === null) {
    return { validationError: 'Transaction Amount must be a valid number. Example: `500000` or `Rp 1.250.000`.' };
  }

  const amountError = validateIDRAmount(parsedAmount);
  if (amountError) return { validationError: amountError };

  // ── Fee responsibility validation ───────────────────────────────────────────
  const rawFeeResp = formData['fee_responsibility']?.trim() ?? '';
  if (!rawFeeResp) return { validationError: 'Fee Responsibility is required. Enter `buyer`, `seller`, or `split`.' };

  const feeResponsibility = parseFeeResponsibility(rawFeeResp);
  if (!feeResponsibility) {
    return { validationError: `Fee Responsibility \`${rawFeeResp}\` is not valid. Please enter **buyer**, **seller**, or **split**.` };
  }

  const [buyer, seller] = await Promise.all([
    resolveParticipant(discordGuild, buyerInput),
    resolveParticipant(discordGuild, sellerInput),
  ]);

  if (buyer && seller && buyer.id === seller.id) {
    return { validationError: 'The Buyer and Seller cannot be the same user.' };
  }

  const warnings: string[] = [];
  if (!buyer) warnings.push(`Could not find Buyer \`${buyerInput}\` in this server. A staff member can add them manually.`);
  if (!seller) warnings.push(`Could not find Seller \`${sellerInput}\` in this server. A staff member can add them manually.`);

  return { buyer, seller, buyerInput, sellerInput, warnings, amount: parsedAmount, feeResponsibility };
}

export class TicketWorkflow {
  static async openTicket(
    discordGuild: DiscordGuild,
    member: GuildMember,
    type: TicketType,
    formData: Record<string, string>,
  ): Promise<{ success: boolean; message: string; channelId?: string }> {
    const guildId = discordGuild.id;
    const userId = member.id;
    const userTag = member.user.tag;

    logger.info(`[Ticket] Button clicked — type=${type} user=${userTag} (${userId}) guild=${guildId}`);

    const guild = await prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) {
      logger.warn(`[Ticket] Guild ${guildId} not configured`);
      return { success: false, message: 'Bot is not configured for this server. An admin must run `/setup` first.' };
    }

    // ── Cooldown check ────────────────────────────────────────────────────────
    const cooldown = await PatternDetector.checkCooldown(guildId, userId, type);
    if (cooldown.onCooldown) {
      return {
        success: false,
        message: `You are on cooldown. You can open another ${type.replace(/_/g, ' ')} ticket <t:${Math.floor(cooldown.expiresAt!.getTime() / 1000)}:R>.`,
      };
    }

    // ── Duplicate check — fetch channel to confirm it still exists ────────────
    logger.info(`[Ticket] Duplicate check — user=${userId} type=${type}`);
    const duplicate = await PatternDetector.checkDuplicateTicket(guildId, userId, type);
    if (duplicate.isDuplicate && duplicate.ticketId) {
      // Use fetch (not cache) — cache is empty after bot restart
      let channelStillExists = false;
      if (duplicate.channelId) {
        try {
          await discordGuild.channels.fetch(duplicate.channelId);
          channelStillExists = true;
        } catch {
          channelStillExists = false;
        }
      }

      if (!channelStillExists) {
        logger.info(`[Ticket] Stale ticket ${duplicate.ticketId} — channel ${duplicate.channelId} gone, auto-closing`);
        await prisma.ticket.update({
          where: { id: duplicate.ticketId },
          data: { status: 'CLOSED', closedReason: 'Auto-closed: channel no longer exists' },
        });
      } else {
        return {
          success: false,
          message: `You already have an open ${type.replace(/_/g, ' ')} ticket. Go to your existing ticket: <#${duplicate.channelId}>`,
        };
      }
    }

    // ── Open ticket limit ─────────────────────────────────────────────────────
    const openCount = await prisma.ticket.count({
      where: { guildId, creatorId: userId, status: { notIn: ['CLOSED', 'ARCHIVED'] } },
    });
    const maxOpen = guild.premiumTier === 'NONE' ? LIMITS.FREE_MAX_OPEN_TICKETS : LIMITS.PREMIUM_MAX_OPEN_TICKETS;
    if (openCount >= maxOpen) {
      return { success: false, message: `You have reached the maximum of ${maxOpen} open tickets.` };
    }

    // ── Risk analysis ─────────────────────────────────────────────────────────
    const riskProfile = await AccountAnalyzer.analyze(member, guildId);
    if (riskProfile.recommendation === 'BLOCK') {
      logger.warn(`[Ticket] Blocked ticket from ${userTag} — risk score ${riskProfile.riskScore}`);
      return { success: false, message: 'You are not allowed to open tickets at this time. Contact an administrator if you believe this is a mistake.' };
    }

    const patterns = PatternDetector.analyzeFormData(formData);

    // ── MIDDLEMAN: resolve and validate participants ───────────────────────────
    let mmParticipants: MiddlemanParticipants | null = null;
    if (type === 'MIDDLEMAN') {
      const resolved = await resolveMiddlemanParticipants(discordGuild, formData);
      if ('validationError' in resolved) {
        return { success: false, message: resolved.validationError };
      }
      mmParticipants = resolved;
    }

    // ── Category + staff role resolution ─────────────────────────────────────
    const customCategory = await prisma.ticketCategory.findFirst({
      where: { guildId, isActive: true, name: type },
    });

    const staffRoleId = customCategory?.staffRoleIds[0] ?? guild.staffRoleIds[0] ?? null;
    const categoryId = customCategory?.discordCategoryId ?? resolveCategoryId(guild, type);

    logger.info(`[Ticket] Creating channel — type=${type} category=${categoryId ?? 'none'} staffRole=${staffRoleId ?? 'none'}`);

    // ── Permission overwrites ─────────────────────────────────────────────────
    const permissionOverwrites: any[] = [
      { id: discordGuild.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    ];

    if (staffRoleId) {
      permissionOverwrites.push({
        id: staffRoleId,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
      });
    }

    for (const adminRoleId of guild.adminRoleIds) {
      if (adminRoleId && adminRoleId !== staffRoleId) {
        permissionOverwrites.push({
          id: adminRoleId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages],
        });
      }
    }

    if (mmParticipants) {
      const addedIds = new Set<string>([userId]);

      if (mmParticipants.buyer && !addedIds.has(mmParticipants.buyer.id)) {
        addedIds.add(mmParticipants.buyer.id);
        permissionOverwrites.push({
          id: mmParticipants.buyer.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        });
      }

      if (mmParticipants.seller && !addedIds.has(mmParticipants.seller.id)) {
        addedIds.add(mmParticipants.seller.id);
        permissionOverwrites.push({
          id: mmParticipants.seller.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        });
      }
    }

    // ── Create Discord channel ────────────────────────────────────────────────
    let channel: TextChannel;
    try {
      // Count existing tickets of this type in this guild to get the next sequential number
      const typeCount = await prisma.ticket.count({ where: { guildId, type, status: { not: 'ARCHIVED' } } });
      const prefix = type.toLowerCase().replace(/_/g, '-');

      // Find an unused channel name — increment until one is free
      let seq = typeCount + 1;
      let channelName = `${prefix}-${String(seq).padStart(3, '0')}`;
      const existing = await discordGuild.channels.fetch();
      const existingNames = new Set(existing.map(c => c?.name ?? ''));
      while (existingNames.has(channelName)) {
        seq++;
        channelName = `${prefix}-${String(seq).padStart(3, '0')}`;
      }

      channel = await discordGuild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryId ?? undefined,
        permissionOverwrites,
        topic: `${type} ticket for ${userTag} | Opened ${new Date().toISOString()}`,
      }) as TextChannel;
      logger.info(`[Ticket] Channel created — ${channel.name} (${channel.id})`);
    } catch (err) {
      logger.error(`[Ticket] Failed to create channel — type=${type} user=${userTag}`, err);
      return {
        success: false,
        message: 'Failed to create ticket channel. Please contact an administrator — the bot may be missing `Manage Channels` permission in the ticket category.',
      };
    }

    // ── Create database record ────────────────────────────────────────────────
    logger.info(`[Ticket] Creating database record — channel=${channel.id}`);
    let ticket: any;
    try {
      ticket = await TicketManager.create({
        guildId,
        creatorId: userId,
        creatorTag: userTag,
        type,
        formData,
        channel,
      });
      logger.info(`[Ticket] Ticket #${ticket.ticketNumber} created — id=${ticket.id}`);
    } catch (err) {
      logger.error(`[Ticket] Failed to create DB record`, err);
      // Channel was created but DB failed — delete the channel to avoid orphan
      await channel.delete().catch(() => {});
      return { success: false, message: 'Failed to save ticket. Please try again.' };
    }

    await PatternDetector.setCooldown(guildId, userId, type, guild.ticketCooldownSeconds);

    // ── Risk / pattern warnings → ticket channel only ────────────────────────
    if (riskProfile.recommendation === 'WARN_STAFF' || patterns.detected) {
      const warnings: string[] = [];
      if (riskProfile.recommendation === 'WARN_STAFF') {
        warnings.push(`⚠️ **Risk Score: ${riskProfile.riskScore}/100**`);
        riskProfile.flags.forEach(f => warnings.push(`• [${f.severity}] ${f.description}`));
      }
      if (patterns.detected) {
        warnings.push('🚨 **Suspicious patterns detected in form:**');
        patterns.patterns.forEach(p => warnings.push(`• ${p}`));
      }
      const mention = staffRoleId ? `||<@&${staffRoleId}>||` : '';
      await channel.send({ content: `${mention}\n${warnings.join('\n')}`.trim() }).catch(() => {});
    }

    // ── Welcome message → ticket channel ─────────────────────────────────────
    logger.info(`[Ticket] Sending welcome message — type=${type}`);
    if (type === 'MIDDLEMAN' && mmParticipants) {
      await this.sendMiddlemanWelcome(channel, ticket, member, mmParticipants, staffRoleId);
    } else {
      await this.sendGenericWelcome(channel, ticket, member, type, formData, staffRoleId);
    }

    return { success: true, message: `Ticket created: <#${channel.id}>`, channelId: channel.id };
  }

  private static readonly PAYMENT_INFO = [
    '━━━━━━━━━━━━━━━━━━━━━━',
    '🏦  **BANK BCA**',
    '',
    '**Nomor Rekening:**',
    '6760 3150 42',
    '',
    '**Atas Nama:**',
    'Azra Reza Satria H',
    '━━━━━━━━━━━━━━━━━━━━━━',
  ].join('\n');

  private static async sendGenericWelcome(
    channel: TextChannel,
    ticket: { id: string; ticketNumber: number },
    creator: GuildMember,
    type: TicketType,
    formData: Record<string, string>,
    staffRoleId: string | null,
  ): Promise<void> {
    // ── Payment embed (Purchase only) ─────────────────────────────────────
    if (type === 'PURCHASE') {
      const paymentEmbed = new EmbedBuilder()
        .setColor(0xf0b132)
        .setTitle('💳 PAYMENT INFORMATION')
        .setDescription(this.PAYMENT_INFO)
        .addFields({
          name: 'Instructions',
          value: 'Please transfer to the account above.\nAfter payment, upload your proof of payment in this ticket and wait for staff verification.',
        });

      await channel.send({ content: `<@${creator.id}>`, embeds: [paymentEmbed] }).catch(() => {});
      return;
    }

    const descriptions: Partial<Record<TicketType, string>> = {
      SUPPORT: 'Please describe your issue in detail. A staff member will assist you shortly.',
      REPORT: 'Your report has been received. Please provide any additional evidence below. Staff will review shortly.',
      REFUND: 'Your refund request has been received. Please provide your transaction details below.',
      APPEAL: 'Your appeal has been received. Please provide your full explanation below.',
      PARTNERSHIP: 'Your partnership request has been received. Staff will review and respond shortly.',
      SERVICE_REQUEST: 'Your service request has been received. A staff member will assist you shortly.',
      SELLER_APPLICATION: 'Your seller application has been received. Staff will review and respond shortly.',
      STAFF_APPLICATION: 'Your staff application has been received. The team will review and respond shortly.',
    };

    const description = descriptions[type] ?? 'A staff member will assist you shortly.';

    const embed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setTitle(`${type.replace(/_/g, ' ')} Ticket #${ticket.ticketNumber}`)
      .setDescription(description)
      .addFields({ name: 'Opened by', value: `<@${creator.id}>` })
      .setFooter({ text: `Ticket ID: ${ticket.id}` })
      .setTimestamp();

    await channel.send({ content: `<@${creator.id}>`, embeds: [embed] }).catch(() => {});
  }

  private static async sendMiddlemanWelcome(
    channel: TextChannel,
    ticket: { id: string; ticketNumber: number },
    creator: GuildMember,
    participants: MiddlemanParticipants,
    staffRoleId: string | null,
  ): Promise<void> {
    const { buyer, seller, buyerInput, sellerInput, warnings, amount, feeResponsibility } = participants;

    const year = new Date().getFullYear();
    const transactionId = `MM-${year}-${String(ticket.ticketNumber).padStart(6, '0')}`;

    const calc = calculateMiddlemanFee(amount, feeResponsibility);

    const feeResponsibilityLabel: Record<typeof feeResponsibility, string> = {
      buyer: 'Buyer Pays Fee',
      seller: 'Seller Pays Fee',
      split: 'Split 50/50',
    };

    const mentionParts = [`<@${creator.id}>`];
    if (buyer) mentionParts.push(`<@${buyer.id}>`);
    if (seller) mentionParts.push(`<@${seller.id}>`);

    // ── Embed 1: Payment information ─────────────────────────────────────
    const paymentEmbed = new EmbedBuilder()
      .setColor(0xf0b132)
      .setTitle('💳 PAYMENT INFORMATION')
      .setDescription(this.PAYMENT_INFO)
      .addFields({
        name: 'Instructions',
        value: `**Buyer** must transfer **Rp ${formatIDR(calc.buyerPays)}** to the account above.\nAfter payment, upload proof of payment in this ticket and wait for staff verification.`,
      });

    // ── Embed 2: Transaction summary ──────────────────────────────────────
    const summaryEmbed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setTitle('💰 Transaction Summary')
      .addFields(
        {
          name: '👥 Participants',
          value: [
            `**Creator:** <@${creator.id}>`,
            `**Buyer:** ${buyer ? `<@${buyer.id}>` : `\`${buyerInput}\` *(not found)*`}`,
            `**Seller:** ${seller ? `<@${seller.id}>` : `\`${sellerInput}\` *(not found)*`}`,
          ].join('\n'),
          inline: false,
        },
        { name: '💵 Transaction Amount', value: `Rp ${formatIDR(calc.amount)}`, inline: true },
        { name: '🏦 Middleman Fee', value: `Rp ${formatIDR(calc.fee)}`, inline: true },
        { name: '📋 Fee Responsibility', value: feeResponsibilityLabel[feeResponsibility], inline: true },
        { name: '💳 Buyer Pays', value: `**Rp ${formatIDR(calc.buyerPays)}**`, inline: true },
        { name: '📤 Seller Receives', value: `Rp ${formatIDR(calc.sellerReceives)}`, inline: true },
        { name: '🆔 Transaction ID', value: `\`${transactionId}\``, inline: true },
        { name: '📊 Status', value: '⏳ Awaiting Payment', inline: false },
      )
      .setFooter({ text: 'Do not send payment until a staff member has verified both parties.' })
      .setTimestamp();

    const fundsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:funds_received:${ticket.id}`)
        .setLabel('Funds Received')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🟢'),
    );

    await channel.send({ content: mentionParts.join(' '), embeds: [paymentEmbed, summaryEmbed], components: [fundsRow] }).catch(() => {});

    if (warnings.length > 0) {
      const warnEmbed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle('⚠️ Participant Warning')
        .setDescription(warnings.join('\n\n'))
        .addFields({
          name: 'Action Required',
          value: staffRoleId
            ? `<@&${staffRoleId}> — please add the missing participant(s) manually.`
            : 'A staff member should add the missing participant(s) manually.',
        });

      await channel.send({ embeds: [warnEmbed] }).catch(() => {});
    }
  }
}
