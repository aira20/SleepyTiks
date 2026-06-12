// MASIH BELUM JALAN, MASIH BINGUNG CARA KERJA NTAR UNTUK KEDEPANNYA

// TAKUT FAKE BLACKLIST, TAKUT JUGA SAMA FAKE VOUCH 

import { PrismaClient } from '@prisma/client';
import type { ChatInputCommandInteraction } from 'discord.js';
import { successEmbed } from '../../components/embeds/success';
import { errorEmbed } from '../../components/embeds/error';

const prisma = new PrismaClient();

export class BlacklistManager {
  static async add(
    guildId: string,
    userId: string,
    userTag: string,
    reason: string,
    addedById: string,
    addedByTag: string,
    isGlobal = false,
    evidence?: string,
    expiresAt?: Date,
  ) {
    return prisma.blacklist.upsert({
      where: { guildId_userId: { guildId, userId } },
      update: { reason, evidence, addedById, addedByTag, isGlobal, expiresAt, isActive: true },
      create: { guildId, userId, userTag, reason, evidence, addedById, addedByTag, isGlobal, expiresAt },
    });
  }

  static async remove(guildId: string, userId: string) {
    return prisma.blacklist.updateMany({
      where: { guildId, userId },
      data: { isActive: false },
    });
  }

  static async isBlacklisted(guildId: string, userId: string): Promise<boolean> {
    const entry = await prisma.blacklist.findFirst({
      where: {
        userId,
        isActive: true,
        OR: [
          { guildId },
          { isGlobal: true },
        ],
      },
    });
    if (!entry) return false;
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      await prisma.blacklist.update({ where: { id: entry.id }, data: { isActive: false } });
      return false;
    }
    return true;
  }

  static async getEntry(guildId: string, userId: string) {
    return prisma.blacklist.findFirst({
      where: { guildId, userId, isActive: true },
    });
  }

  static async listAll(guildId: string) {
    return prisma.blacklist.findMany({
      where: { guildId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Helpers buat dipanggil langsung dari slash command
  async addToBlacklist(
    guildId: string,
    userId: string,
    userTag: string,
    addedById: string,
    addedByTag: string,
    reason: string,
    interaction: ChatInputCommandInteraction,
  ) {
    await BlacklistManager.add(guildId, userId, userTag, reason, addedById, addedByTag);
    return interaction.reply({
      embeds: [successEmbed(`<@${userId}> has been blacklisted.\nReason: ${reason}`)],
      ephemeral: true,
    });
  }

  async removeFromBlacklist(
    guildId: string,
    userId: string,
    userTag: string,
    _actorId: string,
    _actorTag: string,
    interaction: ChatInputCommandInteraction,
  ) {
    const result = await BlacklistManager.remove(guildId, userId);
    if (result.count === 0) {
      return interaction.reply({
        embeds: [errorEmbed(`${userTag} is not currently blacklisted.`)],
        ephemeral: true,
      });
    }
    return interaction.reply({
      embeds: [successEmbed(`<@${userId}> has been removed from the blacklist.`)],
      ephemeral: true,
    });
  }

  async checkBlacklist(
    guildId: string,
    userId: string,
    userTag: string,
    interaction: ChatInputCommandInteraction,
  ) {
    const entry = await BlacklistManager.getEntry(guildId, userId);
    if (!entry) {
      return interaction.reply({
        embeds: [successEmbed(`${userTag} is **not** blacklisted in this server.`)],
        ephemeral: true,
      });
    }
    return interaction.reply({
      embeds: [errorEmbed(
        `${userTag} **is blacklisted**.\n` +
        `Reason: ${entry.reason}\n` +
        `Added by: <@${entry.addedById}> (${entry.addedByTag})\n` +
        `Severity: ${entry.severity}` +
        (entry.expiresAt ? `\nExpires: <t:${Math.floor(entry.expiresAt.getTime() / 1000)}:R>` : ''),
      )],
      ephemeral: true,
    });
  }
}
