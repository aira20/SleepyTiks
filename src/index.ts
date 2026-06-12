import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { client, ExtendedClient } from './bot/client';
import { loadCommands, loadEvents } from './bot/registry';
import { logger } from './utils/logger';

// --- Environment diagnostics ----------------------------------------------
// Goal: figure out, on a Pterodactyl/Sparked container, whether env vars are
// coming from the panel (process.env) or from a dotenv file, and whether the
// Discord token is actually present and well-formed. NEVER print secrets.

const tokenBefore = process.env.DISCORD_TOKEN;
const clientIdBefore = process.env.CLIENT_ID;

const candidateEnvFiles = [
  process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
  '.env',
];

let loadedFrom: string | null = null;
for (const file of candidateEnvFiles) {
  const abs = path.resolve(process.cwd(), file);
  if (fs.existsSync(abs)) {
    // override:false => panel vars win over file vars (matches dotenv default,
    // made explicit so the precedence is obvious in code review).
    dotenv.config({ path: abs, override: false });
    loadedFrom = abs;
    break;
  }
}

const tokenAfter = process.env.DISCORD_TOKEN;
const clientIdAfter = process.env.CLIENT_ID;

const tokenSource = !tokenAfter
  ? 'missing'
  : tokenBefore
    ? 'process.env (panel/shell)'
    : loadedFrom
      ? `dotenv file (${loadedFrom})`
      : 'process.env';

const clientIdSource = !clientIdAfter
  ? 'missing'
  : clientIdBefore
    ? 'process.env (panel/shell)'
    : loadedFrom
      ? `dotenv file (${loadedFrom})`
      : 'process.env';

const tokenLooksValid =
  !!tokenAfter && tokenAfter.split('.').length === 3 && tokenAfter.length > 50;

logger.info('--- env diagnostics ---');
logger.info(`NODE_ENV          = ${process.env.NODE_ENV ?? '(unset)'}`);
logger.info(`cwd               = ${process.cwd()}`);
logger.info(`__dirname         = ${__dirname}`);
logger.info(
  `dotenv loaded     = ${loadedFrom ? `yes (${loadedFrom})` : `no (checked: ${candidateEnvFiles.join(', ')})`}`,
);
logger.info(`DISCORD_TOKEN     = ${tokenAfter ? 'present' : 'MISSING'}`);
logger.info(`token length      = ${tokenAfter ? tokenAfter.length : 0}`);
logger.info(`token format ok   = ${tokenLooksValid}`);
logger.info(`token source      = ${tokenSource}`);
logger.info(`CLIENT_ID         = ${clientIdAfter ? 'present' : 'MISSING'}`);
logger.info(`CLIENT_ID source  = ${clientIdSource}`);
logger.info('-----------------------');

if (!tokenAfter) {
  logger.error(
    'DISCORD_TOKEN is missing. Set it in the Pterodactyl panel Variables tab, or place it in /home/container/.env. Aborting.',
  );
  process.exit(1);
}

if (!tokenLooksValid) {
  logger.error(
    'DISCORD_TOKEN is present but malformed (expected 3 dot-separated segments). Check for surrounding quotes, whitespace, or BOM in the .env file. Aborting.',
  );
  process.exit(1);
}

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
