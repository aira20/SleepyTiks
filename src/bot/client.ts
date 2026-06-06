import { Client, GatewayIntentBits, Collection, Partials } from 'discord.js';
import { Command } from '../types/index';

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Extend client with typed collections
(client as any).commands = new Collection<string, Command>();
(client as any).cooldowns = new Collection<string, Collection<string, number>>();

export type ExtendedClient = typeof client & {
  commands: Collection<string, Command>;
  cooldowns: Collection<string, Collection<string, number>>;
};
