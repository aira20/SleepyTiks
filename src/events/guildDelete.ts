import { Guild } from 'discord.js';
import { logger } from '../utils/logger';

export default {
  name: 'guildDelete',
  once: false,
  async execute(guild: Guild) {
    logger.info(`Left guild: ${guild.name} (${guild.id})`);
  },
};
