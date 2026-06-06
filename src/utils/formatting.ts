import { time, TimestampStyles } from 'discord.js';
import type { TicketStatus, Priority, TransactionStatus } from '@prisma/client';

export function formatDate(date: Date): string {
  return time(date, TimestampStyles.ShortDateTime);
}

export function formatRelative(date: Date): string {
  return time(date, TimestampStyles.RelativeTime);
}

export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function formatTicketId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

type DiscordTimestampStyle = 't' | 'T' | 'd' | 'D' | 'f' | 'F' | 'R';

export function formatTimestamp(date: Date | null | undefined, style: DiscordTimestampStyle = 'F'): string {
  if (!date) return 'N/A';
  const seconds = Math.floor(date.getTime() / 1000);
  return `<t:${seconds}:${style}>`;
}

export function formatDuration(ms: number | bigint | null | undefined): string {
  if (ms == null) return 'N/A';
  const totalMs = typeof ms === 'bigint' ? Number(ms) : ms;
  if (!Number.isFinite(totalMs) || totalMs < 0) return 'N/A';

  const seconds = Math.floor(totalMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function formatCurrency(amount: { toString(): string } | number, currency = 'USD'): string {
  const value = typeof amount === 'number' ? amount : Number(amount.toString());
  if (!Number.isFinite(value)) return `0.00 ${currency}`;
  return `${value.toFixed(2)} ${currency}`;
}

const TICKET_STATUS_BADGE: Record<TicketStatus, string> = {
  OPEN:          '🟢 Open',
  CLAIMED:       '🟡 Claimed',
  IN_PROGRESS:   '🔵 In Progress',
  WAITING_USER:  '⏳ Waiting on User',
  WAITING_STAFF: '⏳ Waiting on Staff',
  ESCALATED:     '🚨 Escalated',
  ON_HOLD:       '⏸️ On Hold',
  CLOSED:        '🔒 Closed',
  ARCHIVED:      '📦 Archived',
};

export function ticketStatusBadge(status: TicketStatus | string): string {
  return TICKET_STATUS_BADGE[status as TicketStatus] ?? String(status);
}

const PRIORITY_BADGE: Record<Priority, string> = {
  LOW:      '🟢 Low',
  NORMAL:   '⚪ Normal',
  HIGH:     '🟠 High',
  URGENT:   '🔴 Urgent',
  CRITICAL: '⛔ Critical',
};

export function priorityBadge(priority: Priority | string): string {
  return PRIORITY_BADGE[priority as Priority] ?? String(priority);
}

const TRANSACTION_STATUS_BADGE: Record<TransactionStatus, string> = {
  PENDING:              '⏳ Pending',
  WAITING_PAYMENT:      '💳 Waiting Payment',
  PAYMENT_CONFIRMED:    '✅ Payment Confirmed',
  DELIVERY_IN_PROGRESS: '📦 Delivery in Progress',
  COMPLETED:            '🎉 Completed',
  DISPUTED:             '⚠️ Disputed',
  CANCELLED:            '❌ Cancelled',
  REFUNDED:             '↩️ Refunded',
};

export function transactionStatusBadge(status: TransactionStatus | string): string {
  return TRANSACTION_STATUS_BADGE[status as TransactionStatus] ?? String(status);
}

export function generateTransactionRef(seq: number): string {
  return `TX-${seq.toString().padStart(6, '0')}`;
}
