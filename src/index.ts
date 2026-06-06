import { client, ExtendedClient } from './bot/client';
import { loadCommands, loadEvents } from './bot/registry';
import { logger } from './utils/logger';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  const extended = client as ExtendedClient;
  await loadEvents(extended);
  await loadCommands(extended);
  await client.login(process.env.DISCORD_TOKEN);
  logger.info('Bot is starting...');
}

main().catch((err) => {
  logger.error('Fatal error during startup:', err);
  process.exit(1);
});
