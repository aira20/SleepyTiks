import { ChatInputCommandInteraction } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { Command } from '../types/index';
import { isStaff, isAdmin, isOwner } from '../utils/permissions';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export async function checkCommandPermissions(
  interaction: ChatInputCommandInteraction,
  command: Command
): Promise<boolean> {
  const member = interaction.guild?.members.cache.get(interaction.user.id);
  if (!member) return false;

  const guild = await prisma.guild.findUnique({ where: { id: interaction.guildId! } });
  if (!guild) return false;

  if (command.ownerOnly && !isOwner(member)) {
    await interaction.reply({ content: 'âŒ This command is restricted to the server owner.', ephemeral: true });
    return false;
  }

  if (command.adminOnly && !isAdmin(member, guild)) {
    await interaction.reply({ content: 'âŒ This command requires Administrator permissions.', ephemeral: true });
    return false;
  }

  if (command.staffOnly && !isStaff(member, guild)) {
    await interaction.reply({ content: 'âŒ This command is for staff only.', ephemeral: true });
    return false;
  }

  if (command.premiumRequired) {
    const tier = guild.premiumTier;
    const tiers = ['FREE', 'BASIC', 'PRO'];
    const required = tiers.indexOf(command.premiumRequired);
    const current = tiers.indexOf(tier);
    if (current < required) {
      await interaction.reply({
        content: `â­ This feature requires **${command.premiumRequired}** tier. Upgrade at https://vaultbot.xyz/premium`,
        ephemeral: true,
      });
      return false;
    }
  }

  return true;
}
