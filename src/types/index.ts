import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  RoleSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  GuildMember,
  TextChannel,
  Collection,
  SlashCommandBuilder,
  ContextMenuCommandBuilder,
} from 'discord.js';
import { PremiumTier, TicketType, TicketStatus, Priority, TransactionStatus } from '@prisma/client';

// ─── Command Interface ───────────────────────────────────────────────────────

export interface Command {
  data: SlashCommandBuilder | ContextMenuCommandBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  premiumRequired?: PremiumTier;
  staffOnly?: boolean;
  adminOnly?: boolean;
  ownerOnly?: boolean;
  guildOnly?: boolean;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  handleButton?: (interaction: ButtonInteraction) => Promise<void>;
  handleModal?: (interaction: ModalSubmitInteraction) => Promise<void>;
  handleSelect?: (interaction: StringSelectMenuInteraction | RoleSelectMenuInteraction | ChannelSelectMenuInteraction) => Promise<void>;
}

// ─── Bot Client Extension ────────────────────────────────────────────────────

export interface BotClient {
  commands: Collection<string, Command>;
  cooldowns: Collection<string, Collection<string, number>>;
}

// ─── Ticket Workflow Types ───────────────────────────────────────────────────

export interface TicketCreateOptions {
  guildId: string;
  creatorId: string;
  creatorTag: string;
  type: TicketType;
  categoryId?: string;
  formData?: Record<string, string>;
  channel: TextChannel;
}

export interface TicketCloseOptions {
  ticketId: string;
  closedById: string;
  closedByTag: string;
  reason?: string;
  generateTranscript?: boolean;
}

export interface TicketTransferOptions {
  ticketId: string;
  newStaffId: string;
  newStaffTag: string;
  transferredById: string;
  transferredByTag: string;
  reason?: string;
}

export interface TicketEscalateOptions {
  ticketId: string;
  escalatedById: string;
  escalatedByTag: string;
  reason: string;
  newPriority?: Priority;
}

// ─── Transaction / Middleman Types ───────────────────────────────────────────

export interface TransactionCreateOptions {
  guildId: string;
  buyerId: string;
  buyerTag: string;
  sellerId: string;
  sellerTag: string;
  item: string;
  description?: string;
  price: number;
  currency: string;
  paymentMethod: string;
  notes?: string;
}

export interface TransactionStatusUpdate {
  transactionId: string;
  newStatus: TransactionStatus;
  updatedById: string;
  updatedByTag: string;
  note?: string;
  proofUrl?: string;
}

// ─── Form Field Definitions ──────────────────────────────────────────────────

export interface FormField {
  id: string;
  label: string;
  placeholder?: string;
  required: boolean;
  style: 'SHORT' | 'PARAGRAPH';
  minLength?: number;
  maxLength?: number;
}

// Predefined form fields per ticket type
export const TICKET_FORMS: Record<TicketType, FormField[]> = {
  SUPPORT: [
    { id: 'subject', label: 'Subject', placeholder: 'Brief summary of your issue', required: true, style: 'SHORT', maxLength: 100 },
    { id: 'description', label: 'Describe your issue', placeholder: 'Provide as much detail as possible...', required: true, style: 'PARAGRAPH', minLength: 20, maxLength: 1000 },
    { id: 'attempted', label: 'What have you already tried?', placeholder: 'Steps you\'ve taken to resolve this...', required: false, style: 'PARAGRAPH', maxLength: 500 },
  ],
  PURCHASE: [
    { id: 'product', label: 'Product / Service', placeholder: 'What are you looking to purchase?', required: true, style: 'SHORT', maxLength: 100 },
    { id: 'budget', label: 'Your Budget', placeholder: 'e.g. $50, negotiable', required: true, style: 'SHORT', maxLength: 50 },
    { id: 'payment_method', label: 'Payment Method', placeholder: 'PayPal, Crypto, etc.', required: true, style: 'SHORT', maxLength: 50 },
    { id: 'details', label: 'Additional Details', placeholder: 'Any specific requirements or questions...', required: false, style: 'PARAGRAPH', maxLength: 500 },
  ],
  MIDDLEMAN: [
    { id: 'buyer_id', label: 'Buyer Discord ID or Username', placeholder: 'e.g. username or 123456789012345678', required: true, style: 'SHORT', maxLength: 100 },
    { id: 'seller_id', label: 'Seller Discord ID or Username', placeholder: 'e.g. username or 123456789012345678', required: true, style: 'SHORT', maxLength: 100 },
    { id: 'item', label: 'Item / Service Description', placeholder: 'Be specific — this goes into the transaction record', required: true, style: 'SHORT', maxLength: 200 },
    { id: 'amount', label: 'Transaction Amount (IDR)', placeholder: 'e.g. 500000 or Rp 1.250.000', required: true, style: 'SHORT', maxLength: 50 },
    { id: 'fee_responsibility', label: 'Fee Responsibility', placeholder: 'buyer / seller / split', required: true, style: 'SHORT', maxLength: 20 },
  ],
  REPORT: [
    { id: 'accused_id', label: 'User Being Reported (ID or Tag)', placeholder: 'Discord ID or username#discriminator', required: true, style: 'SHORT', maxLength: 100 },
    { id: 'reason', label: 'Reason for Report', placeholder: 'Briefly describe the issue', required: true, style: 'SHORT', maxLength: 100 },
    { id: 'description', label: 'Full Description', placeholder: 'Provide full context, what happened, when, etc.', required: true, style: 'PARAGRAPH', minLength: 30, maxLength: 1500 },
    { id: 'evidence', label: 'Evidence (links to screenshots/proof)', placeholder: 'Imgur, Gyazo, or other image URLs', required: false, style: 'PARAGRAPH', maxLength: 500 },
  ],
  REFUND: [
    { id: 'order_ref', label: 'Order / Transaction Reference', placeholder: 'MM-2026-000001 or description of purchase', required: true, style: 'SHORT', maxLength: 100 },
    { id: 'seller_id', label: 'Seller\'s Username', placeholder: 'Who did you purchase from?', required: true, style: 'SHORT', maxLength: 100 },
    { id: 'amount', label: 'Amount Paid', placeholder: 'e.g. $50 USD', required: true, style: 'SHORT', maxLength: 50 },
    { id: 'reason', label: 'Reason for Refund Request', placeholder: 'Why are you requesting a refund?', required: true, style: 'PARAGRAPH', minLength: 20, maxLength: 1000 },
    { id: 'evidence', label: 'Evidence / Proof of Purchase', placeholder: 'Screenshot links, transaction IDs, etc.', required: false, style: 'PARAGRAPH', maxLength: 500 },
  ],
  PARTNERSHIP: [
    { id: 'server_name', label: 'Your Server Name', placeholder: 'Name of your Discord server', required: true, style: 'SHORT', maxLength: 100 },
    { id: 'member_count', label: 'Member Count', placeholder: 'Approximate number of members', required: true, style: 'SHORT', maxLength: 20 },
    { id: 'server_type', label: 'Server Type / Niche', placeholder: 'e.g. Gaming, Trading, Service Selling, etc.', required: true, style: 'SHORT', maxLength: 100 },
    { id: 'invite', label: 'Permanent Invite Link', placeholder: 'discord.gg/...', required: true, style: 'SHORT', maxLength: 100 },
    { id: 'pitch', label: 'Why should we partner with you?', placeholder: 'Tell us about your community and what you bring to the table.', required: true, style: 'PARAGRAPH', minLength: 50, maxLength: 800 },
  ],
  SERVICE_REQUEST: [
    { id: 'service_type', label: 'Type of Service Needed', placeholder: 'e.g. Logo Design, Bot Development, Video Editing', required: true, style: 'SHORT', maxLength: 100 },
    { id: 'description', label: 'Project Description', placeholder: 'Describe exactly what you need...', required: true, style: 'PARAGRAPH', minLength: 30, maxLength: 1500 },
    { id: 'deadline', label: 'Deadline / Timeframe', placeholder: 'e.g. Within 3 days, no rush, by June 15', required: true, style: 'SHORT', maxLength: 100 },
    { id: 'budget', label: 'Budget', placeholder: 'e.g. $50–$100', required: true, style: 'SHORT', maxLength: 50 },
    { id: 'examples', label: 'Examples / References', placeholder: 'Links to examples of what you want (optional)', required: false, style: 'PARAGRAPH', maxLength: 500 },
  ],
  APPEAL: [
    { id: 'ban_reason', label: 'Why were you banned/muted?', placeholder: 'What were you told was the reason?', required: true, style: 'PARAGRAPH', minLength: 10, maxLength: 500 },
    { id: 'your_side', label: 'Your Side of the Story', placeholder: 'Explain what happened from your perspective', required: true, style: 'PARAGRAPH', minLength: 30, maxLength: 1500 },
    { id: 'why_unban', label: 'Why should we unban/unmute you?', placeholder: 'What has changed? Why won\'t this happen again?', required: true, style: 'PARAGRAPH', minLength: 20, maxLength: 800 },
  ],
  SELLER_APPLICATION: [
    { id: 'what_selling', label: 'What do you plan to sell?', placeholder: 'Describe your products or services in detail', required: true, style: 'PARAGRAPH', minLength: 30, maxLength: 1000 },
    { id: 'experience', label: 'Previous Selling Experience', placeholder: 'Other servers, platforms, how long, volume, etc.', required: true, style: 'PARAGRAPH', minLength: 20, maxLength: 800 },
    { id: 'vouches', label: 'Vouches / Reputation Proof', placeholder: 'Links to vouch channels, past reviews, etc.', required: false, style: 'PARAGRAPH', maxLength: 500 },
    { id: 'price_range', label: 'Price Range of Your Products', placeholder: 'e.g. $5–$500', required: true, style: 'SHORT', maxLength: 50 },
    { id: 'payment_methods', label: 'Accepted Payment Methods', placeholder: 'PayPal, Crypto, etc.', required: true, style: 'SHORT', maxLength: 100 },
  ],
  STAFF_APPLICATION: [
    { id: 'age', label: 'Your Age', placeholder: 'How old are you?', required: true, style: 'SHORT', maxLength: 10 },
    { id: 'timezone', label: 'Timezone & Availability', placeholder: 'e.g. EST, available Mon–Fri 6pm–10pm', required: true, style: 'SHORT', maxLength: 100 },
    { id: 'experience', label: 'Moderation / Staff Experience', placeholder: 'Describe your previous moderation or staff experience', required: true, style: 'PARAGRAPH', minLength: 30, maxLength: 1000 },
    { id: 'why_you', label: 'Why should we pick you?', placeholder: 'What makes you stand out?', required: true, style: 'PARAGRAPH', minLength: 30, maxLength: 800 },
    { id: 'scenario', label: 'Scenario: A user is spamming tickets. What do you do?', placeholder: 'Walk us through your approach...', required: true, style: 'PARAGRAPH', minLength: 30, maxLength: 600 },
  ],
  CUSTOM: [],
};

// ─── Anti-Scam Account Analysis ──────────────────────────────────────────────

export interface AccountRiskProfile {
  userId: string;
  accountAgeDays: number;
  riskScore: number; // 0–100
  flags: RiskFlag[];
  recommendation: 'ALLOW' | 'WARN_STAFF' | 'BLOCK';
}

export interface RiskFlag {
  code: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  description: string;
}

// ─── Analytics Types ─────────────────────────────────────────────────────────

export interface GuildAnalyticsSummary {
  period: 'day' | 'week' | 'month';
  ticketsOpened: number;
  ticketsClosed: number;
  avgFirstResponseSec: number;
  avgResolutionSec: number;
  avgRating: number | null;
  topStaff: StaffLeaderboardEntry[];
  ticketsByType: Record<TicketType, number>;
  transactionVolume: number;
  transactionCount: number;
}

export interface StaffLeaderboardEntry {
  userId: string;
  userTag: string;
  ticketsClosed: number;
  avgResponseSec: number;
  avgRating: number | null;
  score: number;
}

// ─── Embed Color Palette ─────────────────────────────────────────────────────

export const Colors = {
  PRIMARY: 0x5865f2,
  SUCCESS: 0x57f287,
  WARNING: 0xfee75c,
  DANGER: 0xed4245,
  INFO: 0x5865f2,
  NEUTRAL: 0x2b2d31,
  GOLD: 0xf0b132,
  PURPLE: 0x9b59b6,
  ORANGE: 0xe67e22,
  TRANSCRIPT: 0x1abc9c,
} as const;

// ─── Status Display Maps ─────────────────────────────────────────────────────

export const TICKET_STATUS_DISPLAY: Record<TicketStatus, { label: string; emoji: string; color: number }> = {
  OPEN:           { label: 'Open',             emoji: '🟢', color: Colors.SUCCESS },
  CLAIMED:        { label: 'Claimed',          emoji: '🔵', color: Colors.PRIMARY },
  IN_PROGRESS:    { label: 'In Progress',      emoji: '🔧', color: Colors.INFO },
  WAITING_USER:   { label: 'Waiting on You',   emoji: '⏳', color: Colors.WARNING },
  WAITING_STAFF:  { label: 'Waiting on Staff', emoji: '🕐', color: Colors.WARNING },
  ESCALATED:      { label: 'Escalated',        emoji: '🔴', color: Colors.DANGER },
  ON_HOLD:        { label: 'On Hold',          emoji: '⏸️', color: Colors.NEUTRAL },
  CLOSED:         { label: 'Closed',           emoji: '🔒', color: 0x747f8d },
  ARCHIVED:       { label: 'Archived',         emoji: '📦', color: 0x747f8d },
};

export const TRANSACTION_STATUS_DISPLAY: Record<TransactionStatus, { label: string; emoji: string; color: number }> = {
  PENDING:              { label: 'Pending',              emoji: '🕐', color: Colors.NEUTRAL },
  WAITING_PAYMENT:      { label: 'Waiting for Payment',  emoji: '💳', color: Colors.WARNING },
  PAYMENT_CONFIRMED:    { label: 'Payment Confirmed',    emoji: '✅', color: Colors.SUCCESS },
  DELIVERY_IN_PROGRESS: { label: 'Delivery In Progress', emoji: '📦', color: Colors.PRIMARY },
  COMPLETED:            { label: 'Completed',            emoji: '🏆', color: Colors.GOLD },
  DISPUTED:             { label: 'Disputed',             emoji: '⚠️', color: Colors.DANGER },
  CANCELLED:            { label: 'Cancelled',            emoji: '❌', color: 0x747f8d },
  REFUNDED:             { label: 'Refunded',             emoji: '↩️', color: Colors.INFO },
};

export const PRIORITY_DISPLAY: Record<Priority, { label: string; emoji: string; color: number }> = {
  LOW:      { label: 'Low',      emoji: '🔽', color: 0x747f8d },
  NORMAL:   { label: 'Normal',   emoji: '➡️', color: Colors.PRIMARY },
  HIGH:     { label: 'High',     emoji: '🔼', color: Colors.WARNING },
  URGENT:   { label: 'Urgent',   emoji: '❗', color: Colors.ORANGE },
  CRITICAL: { label: 'Critical', emoji: '🚨', color: Colors.DANGER },
};
