import { EmbedBuilder } from 'discord.js';
import { Transaction } from '@prisma/client';
import { Colors, TRANSACTION_STATUS_DISPLAY } from '../../types/index';
import { formatCurrency, transactionStatusBadge, formatTimestamp } from '../../utils/formatting';

export function buildTransactionEmbed(tx: Transaction): EmbedBuilder {
  const status = TRANSACTION_STATUS_DISPLAY[tx.status];

  return new EmbedBuilder()
    .setColor(status.color)
    .setTitle(`${status.emoji} Transaction ${tx.humanId}`)
    .addFields(
      { name: '🛒 Item',           value: tx.item,                              inline: false },
      { name: '💰 Price',          value: formatCurrency(tx.price, tx.currency), inline: true },
      { name: '💳 Payment Method', value: tx.paymentMethod,                     inline: true },
      { name: '📊 Status',         value: transactionStatusBadge(tx.status),    inline: true },
      { name: '🛍️ Buyer',          value: `<@${tx.buyerId}>`,                  inline: true },
      { name: '🪙 Seller',         value: `<@${tx.sellerId}>`,                  inline: true },
      ...(tx.middlemanId
        ? [{ name: '🤝 Middleman', value: `<@${tx.middlemanId}>`, inline: true }]
        : []),
      ...(tx.description ? [{ name: '📝 Description', value: tx.description }] : []),
      ...(tx.notes       ? [{ name: '🗒️ Notes',       value: tx.notes       }] : []),
      { name: '📅 Created', value: formatTimestamp(tx.createdAt, 'F'), inline: true },
      ...(tx.completedAt ? [{ name: '✅ Completed', value: formatTimestamp(tx.completedAt, 'R'), inline: true }] : []),
    )
    .setFooter({ text: `Transaction ID: ${tx.id}` })
    .setTimestamp();
}

export function buildTransactionHistoryEmbed(tx: Transaction, history: any[]): EmbedBuilder {
  const lines = history.map(h =>
    `${formatTimestamp(h.createdAt, 'R')} — **${h.changedByTag}** → ${h.toStatus?.replace(/_/g, ' ') ?? 'update'}${h.note ? ` — ${h.note}` : ''}`
  );

  return new EmbedBuilder()
    .setColor(Colors.INFO)
    .setTitle(`📜 Transaction History — ${tx.humanId}`)
    .setDescription(lines.join('\n') || 'No history yet.')
    .setTimestamp();
}
