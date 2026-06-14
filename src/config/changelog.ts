import { EmbedBuilder } from 'discord.js';
import { Colors } from '../types/index';

// ── Changelog storage
// Changelogs ship with the code and are authored here by the developer.
// Add a new entry to the TOP of this array on every release.
// Used by /changelog (public) and /announce-update (admin broadcast).

export interface ChangelogEntry {
  version: string;
  title: string;
  date: string; // ISO date, e.g. '2026-06-14'
  new?: string[];
  improved?: string[];
  fixed?: string[];
}

export const CHANGELOGS: ChangelogEntry[] = [
  {
    version: '1.1.0',
    title: 'Payment System Overhaul',
    date: '2026-06-14',
    new: [
      'Bulk payment management',
      'Custom payment methods',
    ],
    improved: [
      'Auto-refresh payment panel',
    ],
    fixed: [
      'Stale payment menus',
    ],
  },
  {
    version: '1.0.0',
    title: 'Initial Release',
    date: '2026-06-04',
    new: [
      'Ticket system with categories and transcripts',
      'Middleman transaction workflow',
      'Admin panel for server configuration',
    ],
  },
];

export function getLatestChangelog(): ChangelogEntry | undefined {
  return CHANGELOGS[0];
}

export function getChangelogByVersion(version: string): ChangelogEntry | undefined {
  return CHANGELOGS.find(c => c.version === version);
}

export function buildChangelogEmbed(entry: ChangelogEntry): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(Colors.PRIMARY)
    .setTitle(`📦 v${entry.version} — ${entry.title}`)
    .setFooter({ text: `Released ${entry.date}` })
    .setTimestamp(new Date(entry.date));

  if (entry.new?.length) {
    embed.addFields({ name: '✨ New', value: entry.new.map(l => `• ${l}`).join('\n'), inline: false });
  }
  if (entry.improved?.length) {
    embed.addFields({ name: '🔧 Improved', value: entry.improved.map(l => `• ${l}`).join('\n'), inline: false });
  }
  if (entry.fixed?.length) {
    embed.addFields({ name: '🐛 Fixed', value: entry.fixed.map(l => `• ${l}`).join('\n'), inline: false });
  }

  return embed;
}
