import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const cooldownStore = new Map<string, Date>();
const cooldownKey = (guildId: string, userId: string, type: string) => `${guildId}:${userId}:${type}`;

export interface PatternResult {
  detected: boolean;
  patterns: string[];
}

export class PatternDetector {
  /**
   * Detect suspicious patterns in form submission data
   */
  static analyzeFormData(formData: Record<string, string>): PatternResult {
    const patterns: string[] = [];

    const allText = Object.values(formData).join(' ').toLowerCase();

    // Common scam phrases
    const scamPhrases = [
      'i will pay double',
      'send first',
      'trust me',
      'i am admin',
      'discord support',
      'nitro for free',
      'free robux',
      'verify your account',
      'click this link',
    ];

    for (const phrase of scamPhrases) {
      if (allText.includes(phrase)) {
        patterns.push(`Suspicious phrase detected: "${phrase}"`);
      }
    }

    // Suspicious URLs
    const urlPattern = /https?:\/\/[^\s]+/gi;
    const urls = allText.match(urlPattern) ?? [];
    const suspiciousDomains = ['bit.ly', 'tinyurl', 'discord-gift', 'steamcommunity.ru', 'discordapp.gift'];
    for (const url of urls) {
      for (const domain of suspiciousDomains) {
        if (url.includes(domain)) {
          patterns.push(`Suspicious URL detected: ${url}`);
        }
      }
    }

    return { detected: patterns.length > 0, patterns };
  }

  /**
   * Check if a user is opening duplicate tickets
   */
  static async checkDuplicateTicket(
    guildId: string,
    userId: string,
    type: string,
  ): Promise<{ isDuplicate: boolean; ticketId?: string; channelId?: string }> {
    const existing = await prisma.ticket.findFirst({
      where: {
        guildId,
        creatorId: userId,
        type: type as any,
        status: { notIn: ['CLOSED', 'ARCHIVED'] },
      },
      select: { id: true, channelId: true },
    });
    return existing
      ? { isDuplicate: true, ticketId: existing.id, channelId: existing.channelId }
      : { isDuplicate: false };
  }

  /**
   * Check if a user has hit the ticket cooldown
   */
  static async checkCooldown(guildId: string, userId: string, type: string): Promise<{ onCooldown: boolean; expiresAt?: Date }> {
    const key = cooldownKey(guildId, userId, type);
    const expiresAt = cooldownStore.get(key);
    if (!expiresAt) return { onCooldown: false };
    if (expiresAt > new Date()) return { onCooldown: true, expiresAt };
    cooldownStore.delete(key);
    return { onCooldown: false };
  }

  /**
   * Set a cooldown for a user
   */
  static async setCooldown(guildId: string, userId: string, type: string, seconds: number): Promise<void> {
    if (seconds <= 0) return;
    const expiresAt = new Date(Date.now() + seconds * 1000);
    cooldownStore.set(cooldownKey(guildId, userId, type), expiresAt);
  }
}
