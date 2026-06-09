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
  calculateMiddlemanFeeFromTiers,
  formatIDR,
  type FeeResponsibility,
} from '../../utils/middlemanFee';
import {
  getPaymentMethodFee,
  formatPaymentMethodLabel,
  getPaymentMethodFeeFromRules,
  formatPaymentMethodLabelFromRules,
  type DbPaymentFeeRule,
} from '../../utils/paymentFee';
import { ensureGuildDefaults } from '../../utils/defaults';
import { getLocale } from '../../locales';

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
  lang: string,
): Promise<MiddlemanParticipants | { validationError: string }> {
  const t = getLocale(lang);
  const buyerInput = formData['buyer_id']?.trim() ?? '';
  const sellerInput = formData['seller_id']?.trim() ?? '';

  if (!buyerInput || !sellerInput) {
    return { validationError: t.middleman.validationBothRequired };
  }

  const rawAmount = formData['amount']?.trim() ?? '';
  if (!rawAmount) return { validationError: t.middleman.validationAmountRequired };

  const parsedAmount = parseIDRAmount(rawAmount);
  if (parsedAmount === null) {
    return { validationError: t.middleman.validationAmountInvalid };
  }

  const amountError = validateIDRAmount(parsedAmount);
  if (amountError) return { validationError: amountError };

  const rawFeeResp = formData['fee_responsibility']?.trim() ?? '';
  if (!rawFeeResp) return { validationError: t.middleman.validationFeeRequired };

  const feeResponsibility = parseFeeResponsibility(rawFeeResp);
  if (!feeResponsibility) {
    return { validationError: t.middleman.validationFeeInvalid(rawFeeResp) };
  }

  const [buyer, seller] = await Promise.all([
    resolveParticipant(discordGuild, buyerInput),
    resolveParticipant(discordGuild, sellerInput),
  ]);

  if (buyer && seller && buyer.id === seller.id) {
    return { validationError: t.middleman.validationSameUser };
  }

  const warnings: string[] = [];
  if (!buyer) warnings.push(t.middleman.buyerNotFound(buyerInput));
  if (!seller) warnings.push(t.middleman.sellerNotFound(sellerInput));

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
    const lang = formData._lang ?? 'en';
    const t = getLocale(lang);

    logger.info(`[Ticket] Button clicked — type=${type} user=${userTag} (${userId}) guild=${guildId}`);

    const guild = await prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) {
      logger.warn(`[Ticket] Guild ${guildId} not configured`);
      return { success: false, message: t.ticket.notConfigured };
    }

    await ensureGuildDefaults(guildId);

    const [paymentSettings, feeTiers, paymentFeeRules] = await Promise.all([
      prisma.guildPaymentSettings.findUnique({ where: { guildId } }),
      prisma.middlemanFeeTier.findMany({ where: { guildId }, orderBy: { sortOrder: 'asc' } }),
      prisma.paymentFeeRule.findMany({ where: { guildId }, orderBy: { sortOrder: 'asc' } }),
    ]);

    const cooldown = await PatternDetector.checkCooldown(guildId, userId, type);
    if (cooldown.onCooldown) {
      return {
        success: false,
        message: t.ticket.cooldown(type.replace(/_/g, ' '), Math.floor(cooldown.expiresAt!.getTime() / 1000)),
      };
    }

    logger.info(`[Ticket] Duplicate check — user=${userId} type=${type}`);
    const duplicate = await PatternDetector.checkDuplicateTicket(guildId, userId, type);
    if (duplicate.isDuplicate && duplicate.ticketId) {
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
          message: t.ticket.alreadyOpen(type.replace(/_/g, ' '), duplicate.channelId!),
        };
      }
    }

    const openCount = await prisma.ticket.count({
      where: { guildId, creatorId: userId, status: { notIn: ['CLOSED', 'ARCHIVED'] } },
    });
    const maxOpen = guild.premiumTier === 'NONE' ? LIMITS.FREE_MAX_OPEN_TICKETS : LIMITS.PREMIUM_MAX_OPEN_TICKETS;
    if (openCount >= maxOpen) {
      return { success: false, message: t.ticket.maxOpen(maxOpen) };
    }

    const riskProfile = await AccountAnalyzer.analyze(member, guildId);
    if (riskProfile.recommendation === 'BLOCK') {
      logger.warn(`[Ticket] Blocked ticket from ${userTag} — risk score ${riskProfile.riskScore}`);
      return { success: false, message: t.ticket.blocked };
    }

    const patterns = PatternDetector.analyzeFormData(formData);

    let mmParticipants: MiddlemanParticipants | null = null;
    if (type === 'MIDDLEMAN') {
      const resolved = await resolveMiddlemanParticipants(discordGuild, formData, lang);
      if ('validationError' in resolved) {
        return { success: false, message: resolved.validationError };
      }
      mmParticipants = resolved;
    }

    const customCategory = await prisma.ticketCategory.findFirst({
      where: { guildId, isActive: true, name: type },
    });

    const staffRoleId = customCategory?.staffRoleIds[0] ?? guild.staffRoleIds[0] ?? null;
    const categoryId = customCategory?.discordCategoryId ?? resolveCategoryId(guild, type);

    logger.info(`[Ticket] Creating channel — type=${type} category=${categoryId ?? 'none'} staffRole=${staffRoleId ?? 'none'}`);

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

    let channel: TextChannel;
    try {
      const typeCount = await prisma.ticket.count({ where: { guildId, type, status: { not: 'ARCHIVED' } } });
      const prefix = type.toLowerCase().replace(/_/g, '-');

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
      return { success: false, message: t.ticket.createFailed };
    }

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
      await channel.delete().catch(() => {});
      return { success: false, message: t.ticket.saveFailed };
    }

    await PatternDetector.setCooldown(guildId, userId, type, guild.ticketCooldownSeconds);

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

    logger.info(`[Ticket] Sending welcome message — type=${type}`);
    if (type === 'MIDDLEMAN' && mmParticipants) {
      await this.sendMiddlemanWelcome(channel, ticket, member, mmParticipants, staffRoleId, lang, feeTiers, paymentFeeRules, paymentSettings);
    } else {
      await this.sendGenericWelcome(channel, ticket, member, type, lang, staffRoleId, paymentSettings);
    }

    return { success: true, message: t.ticket.created(channel.id), channelId: channel.id };
  }

  private static async sendGenericWelcome(
    channel: TextChannel,
    ticket: { id: string; ticketNumber: number },
    creator: GuildMember,
    type: TicketType,
    lang: string,
    staffRoleId: string | null,
    paymentSettings: { bankName: string; accountNumber: string; accountHolder: string } | null,
  ): Promise<void> {
    const t = getLocale(lang);

    if (type === 'PURCHASE') {
      const bankName = paymentSettings?.bankName ?? 'BCA';
      const accountNumber = paymentSettings?.accountNumber ?? '6760315042';
      const accountHolder = paymentSettings?.accountHolder ?? 'Azra Reza Satria H';
      const paymentEmbed = new EmbedBuilder()
        .setColor(0xf0b132)
        .setTitle(t.middleman.paymentTitle)
        .setDescription(t.middleman.paymentInfo(bankName, accountNumber, accountHolder))
        .addFields({
          name: t.middleman.paymentInstructions,
          value: 'Please transfer to the account above.\nAfter payment, upload your proof of payment in this ticket and wait for staff verification.',
        });
      await channel.send({ content: `<@${creator.id}>`, embeds: [paymentEmbed] }).catch(() => {});
      return;
    }

    const descriptions: Partial<Record<TicketType, string>> = {
      SUPPORT: t.ticket.welcome,
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
      .addFields({ name: t.ticket.openedBy, value: `<@${creator.id}>` })
      .setFooter({ text: `Ticket ID: ${ticket.id}` })
      .setTimestamp();

    await channel.send({ content: `<@${creator.id}>`, embeds: [embed] }).catch(() => {});
  }

  private static async sendMiddlemanWelcome(
    channel: TextChannel,
    ticket: { id: string; ticketNumber: number; formData?: any },
    creator: GuildMember,
    participants: MiddlemanParticipants,
    staffRoleId: string | null,
    lang: string,
    feeTiers: { minAmount: number; maxAmount: number | null; fee: number }[],
    paymentFeeRules: DbPaymentFeeRule[],
    paymentSettings: { bankName: string; accountNumber: string; accountHolder: string } | null,
  ): Promise<void> {
    const t = getLocale(lang);
    const { buyer, seller, buyerInput, sellerInput, warnings, amount, feeResponsibility } = participants;

    const year = new Date().getFullYear();
    const transactionId = `MM-${year}-${String(ticket.ticketNumber).padStart(6, '0')}`;

    // Use DB tiers if available, fall back to hardcoded brackets
    const calc = feeTiers.length > 0
      ? calculateMiddlemanFeeFromTiers(amount, feeTiers, feeResponsibility)
      : calculateMiddlemanFee(amount, feeResponsibility);

    const paymentMethodCode = ticket.formData?.payment_method_code as string | undefined;
    const paymentBankName   = ticket.formData?.payment_method_bank as string | undefined;

    // Use DB rules if available, fall back to hardcoded lookup
    const paymentFee = paymentFeeRules.length > 0
      ? getPaymentMethodFeeFromRules(paymentMethodCode, paymentFeeRules)
      : getPaymentMethodFee(paymentMethodCode);

    const paymentMethodLabel = paymentFeeRules.length > 0
      ? formatPaymentMethodLabelFromRules(paymentMethodCode, paymentFeeRules)
      : formatPaymentMethodLabel(paymentMethodCode, paymentBankName);

    const finalBuyerPays = calc.buyerPays + paymentFee;

    const bankName      = paymentSettings?.bankName      ?? 'BCA';
    const accountNumber = paymentSettings?.accountNumber ?? '6760315042';
    const accountHolder = paymentSettings?.accountHolder ?? 'Azra Reza Satria H';

    const feeLabels = t.middleman.feeLabels;

    const mentionParts = [`<@${creator.id}>`];
    if (buyer) mentionParts.push(`<@${buyer.id}>`);
    if (seller) mentionParts.push(`<@${seller.id}>`);

    const paymentEmbed = new EmbedBuilder()
      .setColor(0xf0b132)
      .setTitle(t.middleman.paymentTitle)
      .setDescription(t.middleman.paymentInfo(bankName, accountNumber, accountHolder))
      .addFields({
        name: t.middleman.paymentInstructions,
        value: t.middleman.paymentInstructionText(`Rp ${formatIDR(finalBuyerPays)}`),
      });

    const summaryFields: { name: string; value: string; inline: boolean }[] = [
      {
        name: t.middleman.participants,
        value: [
          `${t.middleman.creator} <@${creator.id}>`,
          `${t.middleman.buyer} ${buyer ? `<@${buyer.id}>` : t.middleman.buyerNotFound(buyerInput)}`,
          `${t.middleman.seller} ${seller ? `<@${seller.id}>` : t.middleman.sellerNotFound(sellerInput)}`,
        ].join('\n'),
        inline: false,
      },
      { name: t.middleman.itemPrice,        value: `Rp ${formatIDR(calc.amount)}`,        inline: true },
      { name: t.middleman.mmFee,            value: `Rp ${formatIDR(calc.fee)}`,           inline: true },
      { name: t.middleman.paymentFee,       value: `Rp ${formatIDR(paymentFee)}`,         inline: true },
      { name: t.middleman.paymentMethod,    value: paymentMethodLabel,                    inline: true },
      { name: t.middleman.feeResponsibility, value: feeLabels[feeResponsibility],         inline: true },
      { name: t.middleman.transactionId,    value: `\`${transactionId}\``,                inline: true },
      { name: t.middleman.buyerPays,        value: `**Rp ${formatIDR(finalBuyerPays)}**`, inline: true },
      { name: t.middleman.sellerReceives,   value: `Rp ${formatIDR(calc.sellerReceives)}`, inline: true },
      { name: '​',                      value: '​',                               inline: true },
      { name: t.middleman.status,           value: t.middleman.awaitingPayment,           inline: false },
    ];

    const summaryEmbed = new EmbedBuilder()
      .setColor(Colors.PRIMARY)
      .setTitle(t.middleman.summaryTitle)
      .setDescription(
        t.middleman.summaryText(
          `Rp ${formatIDR(calc.amount)}`,
          `Rp ${formatIDR(calc.fee)}`,
          `Rp ${formatIDR(paymentFee)}`,
          paymentMethodLabel,
          `Rp ${formatIDR(finalBuyerPays)}`,
        )
      )
      .addFields(summaryFields)
      .setFooter({ text: t.middleman.summaryFooter })
      .setTimestamp();

    const fundsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:funds_received:${ticket.id}`)
        .setLabel(t.middleman.fundsButton)
        .setStyle(ButtonStyle.Success)
        .setEmoji('🟢'),
    );

    await channel.send({ content: mentionParts.join(' '), embeds: [paymentEmbed, summaryEmbed], components: [fundsRow] }).catch(() => {});

    if (warnings.length > 0) {
      const warnEmbed = new EmbedBuilder()
        .setColor(Colors.WARNING)
        .setTitle(t.middleman.warningTitle)
        .setDescription(warnings.join('\n\n'))
        .addFields({
          name: t.middleman.warningAction,
          value: staffRoleId
            ? t.middleman.warningActionStaff(staffRoleId)
            : t.middleman.warningActionNoRole,
        });

      await channel.send({ embeds: [warnEmbed] }).catch(() => {});
    }
  }
}
