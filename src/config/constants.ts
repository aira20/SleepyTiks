export const BOT_VERSION = '1.0.0';
export const BOT_NAME = 'VaultBot';

export const LIMITS = {
  FREE_MAX_OPEN_TICKETS: 3,
  FREE_MONTHLY_TICKETS: 50,
  PREMIUM_MAX_OPEN_TICKETS: 50,
  TICKET_COOLDOWN_SECONDS: 300,
  MAX_NOTE_LENGTH: 1000,
  MAX_REASON_LENGTH: 500,
  TRANSCRIPT_MAX_MESSAGES: 500,
  PREMIUM_TRANSCRIPT_MAX_MESSAGES: 5000,
};

export const TIMEOUTS = {
  MODAL_WAIT_MS: 300_000,        // 5 minutes
  BUTTON_COLLECT_MS: 600_000,    // 10 minutes
  AUTO_CLOSE_WARNING_HOURS: 24,
  AUTO_CLOSE_DEFAULT_HOURS: 48,
};

export const EMOJIS = {
  TICKET:      '🎫',
  LOCK:        '🔒',
  UNLOCK:      '🔓',
  STAR:        '⭐',
  WARN:        '⚠️',
  CHECK:       '✅',
  CROSS:       '❌',
  CLOCK:       '🕐',
  MONEY:       '💰',
  SHIELD:      '🛡️',
  FIRE:        '🔥',
  PIN:         '📌',
  NOTE:        '📝',
  GRAPH:       '📊',
  CROWN:       '👑',
  HANDSHAKE:   '🤝',
  ESCALATE:    '🔴',
  TRANSFER:    '↔️',
};

export const PREMIUM_FEATURES = [
  'MIDDLEMAN_SYSTEM',
  'ADVANCED_ANALYTICS',
  'AUTO_ASSIGNMENT',
  'AUTO_ESCALATION',
  'SMART_ROUTING',
  'STAFF_LEADERBOARD',
  'SHIFT_MANAGEMENT',
  'VOUCH_SYSTEM',
  'REPUTATION_SYSTEM',
  'BLACKLIST_GLOBAL',
  'SATISFACTION_RATINGS',
  'FOLLOW_UP_REMINDERS',
  'MULTI_SERVER',
  'CUSTOM_BRANDING',
  'CUSTOM_WORKFLOWS',
] as const;

export type PremiumFeature = typeof PREMIUM_FEATURES[number];
