import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import { prisma } from '../../utils/prisma';
import { Colors } from '../../types/index';
import { logger } from '../../utils/logger';

const VERSION = '1.0.0';

export const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Check the operational status of Sleepy Tiks')
  .addStringOption(opt =>
    opt
      .setName('service')
      .setDescription('Check a specific service in detail')
      .setRequired(false)
      .addChoices(
        { name: 'bot',         value: 'bot'         },
        { name: 'database',    value: 'database'    },
        { name: 'tickets',     value: 'tickets'     },
        { name: 'middleman',   value: 'middleman'   },
        { name: 'marketplace', value: 'marketplace' },
      ),
  );

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatUptime(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const d = Math.floor(totalSecs / 86400);
  const h = Math.floor((totalSecs % 86400) / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function formatMemory(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

interface SystemStatus {
  dbOk: boolean;
  dbLatencyMs: number;
  openTickets: number;
  totalTickets: number;
  totalTransactions: number;
  guilds: number;
  wsLatency: number;
  uptimeMs: number;
  memoryMB: number;
  nodeVersion: string;
}

async function gatherStatus(client: ChatInputCommandInteraction['client']): Promise<SystemStatus> {
  const wsLatency = client.ws.ping;
  const uptimeMs = (client.uptime ?? 0);
  const mem = process.memoryUsage();
  const memoryMB = Math.round(mem.rss / 1024 / 1024);
  const nodeVersion = process.version;
  const guilds = client.guilds.cache.size;

  let dbOk = false;
  let dbLatencyMs = 0;
  let openTickets = 0;
  let totalTickets = 0;
  let totalTransactions = 0;

  try {
    const dbStart = Date.now();
    const [open, total, transactions] = await Promise.all([
      prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.ticket.count(),
      prisma.transaction.count(),
    ]);
    dbLatencyMs = Date.now() - dbStart;
    dbOk = true;
    openTickets = open;
    totalTickets = total;
    totalTransactions = transactions;
  } catch (err) {
    logger.warn('Status command: database check failed', err);
  }

  return { dbOk, dbLatencyMs, openTickets, totalTickets, totalTransactions, guilds, wsLatency, uptimeMs, memoryMB, nodeVersion };
}

// ── Embed builders ────────────────────────────────────────────────────────────

function buildOverviewEmbed(s: SystemStatus): EmbedBuilder {
  const allOk = s.dbOk;
  const color = allOk ? Colors.SUCCESS : Colors.DANGER;
  const statusIcon = allOk ? '🟢' : '🔴';

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`${statusIcon} Sleepy Tiks Status`)
    .addFields(
      { name: '🤖 Bot Status',          value: 'Online',                                          inline: true },
      { name: '🗄️ Database',            value: s.dbOk ? `Connected (${s.dbLatencyMs}ms)` : '❌ Offline', inline: true },
      { name: '📡 WS Latency',          value: `${s.wsLatency}ms`,                               inline: true },
      { name: '⏱️ Uptime',              value: formatUptime(s.uptimeMs),                         inline: true },
      { name: '🏷️ Version',             value: `v${VERSION}`,                                    inline: true },
      { name: '🖥️ Memory',              value: `${s.memoryMB} MB`,                               inline: true },
      { name: '​',                 value: '​',                                          inline: false },
      { name: '🎫 Tickets System',      value: '✅ Operational',                                  inline: true },
      { name: '🤝 Middleman System',    value: '✅ Operational',                                  inline: true },
      { name: '🛒 Marketplace System',  value: '✅ Operational',                                  inline: true },
      { name: '​',                 value: '​',                                          inline: false },
      { name: '🌐 Guilds',              value: `${s.guilds}`,                                     inline: true },
      { name: '📂 Open Tickets',        value: `${s.openTickets}`,                               inline: true },
      { name: '📋 Total Tickets',       value: `${s.totalTickets}`,                              inline: true },
      { name: '💼 Transactions',        value: `${s.totalTransactions}`,                         inline: true },
      { name: '🟩 Node.js',             value: s.nodeVersion,                                    inline: true },
    )
    .setFooter({ text: 'Last updated' })
    .setTimestamp();
}

function buildServiceEmbed(service: string, s: SystemStatus): EmbedBuilder {
  switch (service) {
    case 'bot':
      return new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle('🤖 Bot — Detailed Status')
        .addFields(
          { name: 'Status',      value: 'Online',                    inline: true },
          { name: 'WS Latency',  value: `${s.wsLatency}ms`,         inline: true },
          { name: 'Uptime',      value: formatUptime(s.uptimeMs),   inline: true },
          { name: 'Version',     value: `v${VERSION}`,              inline: true },
          { name: 'Node.js',     value: s.nodeVersion,              inline: true },
          { name: 'Memory (RSS)',value: `${s.memoryMB} MB`,         inline: true },
          { name: 'Guilds',      value: `${s.guilds}`,              inline: true },
        )
        .setFooter({ text: 'Last updated' })
        .setTimestamp();

    case 'database':
      return new EmbedBuilder()
        .setColor(s.dbOk ? Colors.SUCCESS : Colors.DANGER)
        .setTitle('🗄️ Database — Detailed Status')
        .addFields(
          { name: 'Status',        value: s.dbOk ? '✅ Connected' : '❌ Offline',    inline: true },
          { name: 'Query Latency', value: s.dbOk ? `${s.dbLatencyMs}ms` : 'N/A',  inline: true },
          { name: 'Total Tickets', value: `${s.totalTickets}`,                     inline: true },
          { name: 'Transactions',  value: `${s.totalTransactions}`,               inline: true },
        )
        .setFooter({ text: 'Last updated' })
        .setTimestamp();

    case 'tickets':
      return new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle('🎫 Tickets System — Detailed Status')
        .addFields(
          { name: 'Status',        value: '✅ Operational',      inline: true },
          { name: 'Open Tickets',  value: `${s.openTickets}`,   inline: true },
          { name: 'Total Tickets', value: `${s.totalTickets}`,  inline: true },
        )
        .setFooter({ text: 'Last updated' })
        .setTimestamp();

    case 'middleman':
      return new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle('🤝 Middleman System — Detailed Status')
        .addFields(
          { name: 'Status',       value: '✅ Operational',          inline: true },
          { name: 'Transactions', value: `${s.totalTransactions}`, inline: true },
        )
        .setFooter({ text: 'Last updated' })
        .setTimestamp();

    case 'marketplace':
      return new EmbedBuilder()
        .setColor(Colors.SUCCESS)
        .setTitle('🛒 Marketplace System — Detailed Status')
        .addFields(
          { name: 'Status', value: '✅ Operational', inline: true },
        )
        .setFooter({ text: 'Last updated' })
        .setTimestamp();

    default:
      return buildOverviewEmbed(s);
  }
}

// ── Command handler ───────────────────────────────────────────────────────────

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();

  const service = interaction.options.getString('service');

  logger.info(`Status command invoked by ${interaction.user.tag}${service ? ` (service: ${service})` : ''}`);

  const s = await gatherStatus(interaction.client);
  const embed = service ? buildServiceEmbed(service, s) : buildOverviewEmbed(s);

  await interaction.editReply({ embeds: [embed] });
}
