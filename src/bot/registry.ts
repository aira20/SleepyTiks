import { readdirSync } from 'fs';
import { join } from 'path';
import { REST, Routes } from 'discord.js';
import { ExtendedClient } from './client';
import { Command } from '../types/index';
import { logger } from '../utils/logger';

export async function loadCommands(client: ExtendedClient): Promise<void> {
  const commandsPath = join(__dirname, '..', 'commands');
  const folders = readdirSync(commandsPath);

  for (const folder of folders) {
    const folderPath = join(commandsPath, folder);
    const files = readdirSync(folderPath).filter(f => f.endsWith('.js'));

    for (const file of files) {
      try {
        const mod = await import(join(folderPath, file));
        const command: Command = mod.default ?? mod;
        if (!command?.data?.name) continue;
        client.commands.set(command.data.name, command);
        logger.info(`Loaded command: ${command.data.name}`);
      } catch (err) {
        logger.error(`Failed to load command ${file}`, err);
      }
    }
  }
}

export async function loadEvents(client: ExtendedClient): Promise<void> {
  const eventsPath = join(__dirname, '..', 'events');
  const files = readdirSync(eventsPath).filter(f => f.endsWith('.js'));

  for (const file of files) {
    try {
      const mod = await import(join(eventsPath, file));
      const event = mod.default;
      if (event.once) {
        client.once(event.name, (...args: unknown[]) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args: unknown[]) => event.execute(...args, client));
      }
      logger.info(`Loaded event: ${event.name}`);
    } catch (err) {
      logger.error(`Failed to load event ${file}`, err);
    }
  }
}

export async function registerSlashCommands(client: ExtendedClient): Promise<void> {
  const token = process.env.DISCORD_TOKEN!;
  const clientId = process.env.CLIENT_ID!;

  const rest = new REST({ version: '10' }).setToken(token);
  const commandData = [...client.commands.values()].map(c => c.data.toJSON());

  try {
    logger.info(`Registering ${commandData.length} slash commands...`);
    await rest.put(Routes.applicationCommands(clientId), { body: commandData });
    logger.info('Slash commands registered successfully.');
  } catch (err) {
    logger.error('Failed to register slash commands', err);
  }
}
