// DO THIS NEXT, WAJIB


// DONE PROCESS -> POP UP OR BUTTON SHOW UP -> PRESS VOUCH WITH STARS => 5, AND THIS WILL BE GLOBALLY SEEN (TO SHOW TRUSTY MIDDLEMAN)

import { PrismaClient } from '@prisma/client';
import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { Colors } from '../../types/index';
import { successEmbed } from '../../components/embeds/success';
import { errorEmbed } from '../../components/embeds/error';

const prisma = new PrismaClient();

export interface VouchSummary {
  userId: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
  score: number;
  averageRating: number;
  recentVouches: { rating: number; comment: string | null; giverTag: string; createdAt: Date }[];
}

const POSITIVE_THRESHOLD = 4;
const NEGATIVE_THRESHOLD = 2;

export class VouchSystem {
  static async addVouch(
    guildId: string,
    giverId: string,
    giverTag: string,
    receiverId: string,
    receiverTag: string,
    rating: number,
    comment?: string,
    transactionId?: string,
  ) {
    if (giverId === receiverId) throw new Error('You cannot vouch for yourself.');

    if (transactionId) {
      const existing = await prisma.vouch.findFirst({ where: { guildId, giverId, transactionId } });
      if (existing) throw new Error('You have already submitted a vouch for this transaction.');
    }

    return prisma.vouch.create({
      data: { guildId, giverId, giverTag, receiverId, receiverTag, rating, comment, transactionId },
    });
  }

  static async getSummary(guildId: string, userId: string): Promise<VouchSummary> {
    const vouches = await prisma.vouch.findMany({
      where: { guildId, receiverId: userId, isRemoved: false },
      orderBy: { createdAt: 'desc' },
    });

    const positive = vouches.filter(v => v.rating >= POSITIVE_THRESHOLD).length;
    const negative = vouches.filter(v => v.rating <= NEGATIVE_THRESHOLD).length;
    const neutral  = vouches.length - positive - negative;
    const score    = positive - negative;
    const averageRating = vouches.length === 0
      ? 0
      : vouches.reduce((sum, v) => sum + v.rating, 0) / vouches.length;

    return {
      userId,
      positive,
      negative,
      neutral,
      total: vouches.length,
      score,
      averageRating,
      recentVouches: vouches.slice(0, 5).map(v => ({
        rating: v.rating,
        comment: v.comment,
        giverTag: v.giverTag,
        createdAt: v.createdAt,
      })),
    };
  }

  async giveVouch(
    guildId: string,
    giverId: string,
    giverTag: string,
    receiverId: string,
    receiverTag: string,
    comment: string,
    interaction: ChatInputCommandInteraction,
  ) {
    try {
      await VouchSystem.addVouch(guildId, giverId, giverTag, receiverId, receiverTag, 5, comment || undefined);
      return interaction.reply({
        embeds: [successEmbed(`Vouch submitted for <@${receiverId}>${comment ? `\n> ${comment}` : ''}`)],
        ephemeral: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit vouch.';
      return interaction.reply({ embeds: [errorEmbed(message)], ephemeral: true });
    }
  }

  async showReputation(
    guildId: string,
    userId: string,
    userTag: string,
    interaction: ChatInputCommandInteraction,
  ) {
    const summary = await VouchSystem.getSummary(guildId, userId);

    const embed = new EmbedBuilder()
      .setColor(summary.score >= 0 ? Colors.SUCCESS : Colors.DANGER)
      .setTitle(`Reputation — ${userTag}`)
      .addFields(
        { name: 'Score',         value: String(summary.score),            inline: true },
        { name: 'Total Vouches', value: String(summary.total),            inline: true },
        { name: 'Avg Rating',    value: summary.averageRating.toFixed(2), inline: true },
        { name: '👍 Positive',   value: String(summary.positive),         inline: true },
        { name: '👎 Negative',   value: String(summary.negative),         inline: true },
        { name: '😐 Neutral',    value: String(summary.neutral),          inline: true },
      );

    if (summary.recentVouches.length > 0) {
      embed.addFields({
        name: 'Recent vouches',
        value: summary.recentVouches
          .map(v => `**${v.rating}/5** — ${v.giverTag}${v.comment ? `: ${v.comment}` : ''}`)
          .join('\n')
          .slice(0, 1024),
      });
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}
