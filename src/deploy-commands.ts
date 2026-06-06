import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load env file: .env.development → .env.production → .env (fallback)
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.resolve(__dirname, '..', envFile) });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') }); // fallback

const commands: unknown[] = [];

function loadCommandsFromDir(dir: string) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadCommandsFromDir(full);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(full);
      if (mod.data) commands.push(mod.data.toJSON());
    }
  }
}

loadCommandsFromDir(path.join(__dirname, 'commands'));

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log(`Deploying ${commands.length} application commands...`);
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!),
      { body: commands },
    );
    console.log('Commands deployed successfully.');
  } catch (err) {
    console.error(err);
  }
})();
