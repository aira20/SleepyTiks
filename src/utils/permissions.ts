import { GuildMember, PermissionFlagsBits } from 'discord.js';
import { Guild } from '@prisma/client';

export function isStaff(member: GuildMember, guild: Guild): boolean {
  if (isAdmin(member, guild)) return true;
  if (guild.staffRoleIds.some(id => member.roles.cache.has(id))) return true;
  return member.permissions.has(PermissionFlagsBits.ManageMessages);
}

export function isAdmin(member: GuildMember, guild: Guild): boolean {
  if (isOwner(member)) return true;
  if (guild.adminRoleIds.some(id => member.roles.cache.has(id))) return true;
  return member.permissions.has(PermissionFlagsBits.Administrator);
}

export function isOwner(member: GuildMember): boolean {
  return member.id === member.guild.ownerId;
}

export function canManageTicket(member: GuildMember, guild: Guild, ticketCreatorId: string): boolean {
  return isStaff(member, guild) || member.id === ticketCreatorId;
}

// ── Per-action ticket permission checks ──────────────────────────────────────

export function canCloseTicket(member: GuildMember, guild: Guild, creatorId: string): boolean {
  return isStaff(member, guild) || member.id === creatorId;
}

export function canReopenTicket(member: GuildMember, guild: Guild): boolean {
  return isStaff(member, guild);
}

export function canClaimTicket(member: GuildMember, guild: Guild): boolean {
  return isStaff(member, guild);
}

export function canDeleteTicket(member: GuildMember, guild: Guild): boolean {
  return isAdmin(member, guild);
}

export function canMoveTicket(member: GuildMember, guild: Guild): boolean {
  return isStaff(member, guild);
}

export function canEscalateTicket(member: GuildMember, guild: Guild): boolean {
  return isStaff(member, guild);
}

export function canAccessAdminPanel(member: GuildMember, guild: Guild): boolean {
  return isAdmin(member, guild);
}
