import { Guild } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export default {
  name: 'guildCreate',
  once: false,
  async execute(guild: Guild) {
    try {
      await prisma.guild.upsert({
        where: { id: guild.id },
        update: { name: guild.name },
        create: { id: guild.id, name: guild.name },
      });
      logger.info(`Joined guild: ${guild.name} (${guild.id})`);
    } catch (err) {
      logger.error('guildCreate error', err);
    }
  },
};
