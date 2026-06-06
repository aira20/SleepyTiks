import { ActivityType } from 'discord.js';
import { ExtendedClient } from '../bot/client';
import { logger } from '../utils/logger';
import { BOT_NAME, BOT_VERSION } from '../config/constants';

export default {
  name: 'ready',
  once: true,
  async execute(_: unknown, client: ExtendedClient) {
    logger.info(`${BOT_NAME} v${BOT_VERSION} is online as ${client.user?.tag}`);

    client.user?.setPresence({
      activities: [{ name: '/ticket | vaultbot.xyz', type: ActivityType.Watching }],
      status: 'online',
    });
  },
};
