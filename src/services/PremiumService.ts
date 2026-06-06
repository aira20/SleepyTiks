import { PrismaClient, PremiumTier } from '@prisma/client';
import { PremiumFeature } from '../config/constants';

const prisma = new PrismaClient();

const FEATURE_REQUIREMENTS: Record<PremiumFeature, PremiumTier> = {
  MIDDLEMAN_SYSTEM:      'BASIC',
  ADVANCED_ANALYTICS:    'BASIC',
  AUTO_ASSIGNMENT:       'BASIC',
  AUTO_ESCALATION:       'BASIC',
  SMART_ROUTING:         'BASIC',
  STAFF_LEADERBOARD:     'BASIC',
  SHIFT_MANAGEMENT:      'BASIC',
  VOUCH_SYSTEM:          'BASIC',
  REPUTATION_SYSTEM:     'BASIC',
  SATISFACTION_RATINGS:  'BASIC',
  FOLLOW_UP_REMINDERS:   'BASIC',
  BLACKLIST_GLOBAL:      'PRO',
  MULTI_SERVER:          'PRO',
  CUSTOM_BRANDING:       'PRO',
  CUSTOM_WORKFLOWS:      'PRO',
};

const TIER_RANK: Record<PremiumTier, number> = {
  NONE:     0,
  BASIC:    1,
  PRO:      2,
  LIFETIME: 3,
};

export class PremiumService {
  static async getGuildTier(guildId: string): Promise<PremiumTier> {
    const guild = await prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) return 'NONE';
    if (guild.premiumTier === 'LIFETIME') return 'LIFETIME';
    if (guild.premiumExpiresAt && guild.premiumExpiresAt < new Date()) return 'NONE';
    return guild.premiumTier;
  }

  static async isPremium(guildId: string): Promise<boolean> {
    const tier = await this.getGuildTier(guildId);
    return TIER_RANK[tier] >= TIER_RANK.BASIC;
  }

  static async hasFeature(guildId: string, feature: PremiumFeature): Promise<boolean> {
    const tier = await this.getGuildTier(guildId);
    const required = FEATURE_REQUIREMENTS[feature];
    return TIER_RANK[tier] >= TIER_RANK[required];
  }

  static async setTier(guildId: string, tier: PremiumTier, expiresAt?: Date): Promise<void> {
    await prisma.guild.update({
      where: { id: guildId },
      data: {
        premiumTier: tier,
        isPremium: TIER_RANK[tier] >= TIER_RANK.BASIC,
        premiumExpiresAt: expiresAt ?? null,
      },
    });
  }

  // Instance proxies â€” many command files use `new PremiumService()`
  isPremium(guildId: string): Promise<boolean> { return PremiumService.isPremium(guildId); }
  getGuildTier(guildId: string): Promise<PremiumTier> { return PremiumService.getGuildTier(guildId); }
  hasFeature(guildId: string, feature: PremiumFeature): Promise<boolean> { return PremiumService.hasFeature(guildId, feature); }
  setTier(guildId: string, tier: PremiumTier, expiresAt?: Date): Promise<void> { return PremiumService.setTier(guildId, tier, expiresAt); }
}
