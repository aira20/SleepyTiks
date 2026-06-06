import { TextChannel, Message } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import { client } from '../../bot/client';
import { logger } from '../../utils/logger';
import { LIMITS } from '../../config/constants';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

export interface TranscriptResult {
  filename: string;
  buffer: Buffer;
}

export class TranscriptGenerator {
  /**
   * Generates a transcript and returns it as a Buffer + filename for Discord upload.
   * Also writes the file locally as a backup.
   */
  static async generateBuffer(
    channelId: string,
    guildId: string,
    ticketNumber: number,
  ): Promise<TranscriptResult | undefined> {
    try {
      const channel = await client.channels.fetch(channelId).catch(() => null) as TextChannel | null;
      if (!channel) return undefined;

      const guild = await prisma.guild.findUnique({ where: { id: guildId } });
      const isPremium = guild?.premiumTier !== 'NONE' && guild?.premiumTier !== undefined;
      const maxMessages = isPremium ? LIMITS.PREMIUM_TRANSCRIPT_MAX_MESSAGES : LIMITS.TRANSCRIPT_MAX_MESSAGES;

      const messages: Message[] = [];
      let lastId: string | undefined;

      while (messages.length < maxMessages) {
        const batch = await channel.messages.fetch({ limit: 100, before: lastId });
        if (batch.size === 0) break;
        messages.push(...batch.values());
        lastId = batch.last()?.id;
        if (batch.size < 100) break;
      }

      messages.reverse();

      const html = this.buildHtml(messages, ticketNumber, channel.name);
      const buffer = Buffer.from(html, 'utf-8');
      const filename = `ticket-${ticketNumber}.htm`;

      // Also write locally as backup
      try {
        const transcriptsDir = join(process.cwd(), 'transcripts');
        mkdirSync(transcriptsDir, { recursive: true });
        writeFileSync(join(transcriptsDir, `ticket-${ticketNumber}-${Date.now()}.html`), html, 'utf-8');
      } catch {
        // Local write failure is non-fatal
      }

      return { filename, buffer };
    } catch (err) {
      logger.error('TranscriptGenerator.generateBuffer error', err);
      return undefined;
    }
  }

  /** Legacy method — kept for backwards compatibility with existing callers. */
  static async generate(channelId: string, guildId: string, ticketNumber: number): Promise<string | undefined> {
    try {
      const result = await this.generateBuffer(channelId, guildId, ticketNumber);
      if (!result) return undefined;

      const transcriptsDir = join(process.cwd(), 'transcripts');
      const filepath = join(transcriptsDir, result.filename);
      const baseUrl = process.env.TRANSCRIPT_BASE_URL;
      return baseUrl ? `${baseUrl}/${result.filename}` : filepath;
    } catch (err) {
      logger.error('TranscriptGenerator.generate error', err);
      return undefined;
    }
  }

  private static buildHtml(messages: Message[], ticketNumber: number, channelName: string): string {
    const rows = messages.map(m => {
      const time = m.createdAt.toISOString();
      const author = m.author.tag;
      const content = m.content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const attachments = m.attachments.map(a => `<a href="${a.url}" target="_blank">[Attachment: ${a.name}]</a>`).join(' ');
      return `
        <div class="message">
          <span class="time">${time}</span>
          <span class="author">${author}</span>
          <span class="content">${content} ${attachments}</span>
        </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket #${ticketNumber} Transcript</title>
  <style>
    body { background: #36393f; color: #dcddde; font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; }
    h1 { color: #fff; border-bottom: 1px solid #4f545c; padding-bottom: 10px; }
    .message { padding: 6px 12px; border-radius: 4px; margin: 2px 0; }
    .message:hover { background: #32353b; }
    .time { color: #72767d; font-size: 0.75em; margin-right: 8px; }
    .author { color: #7289da; font-weight: bold; margin-right: 8px; }
    .content { color: #dcddde; }
    a { color: #00b0f4; }
  </style>
</head>
<body>
  <h1>📋 Ticket #${ticketNumber} — #${channelName}</h1>
  <p style="color:#72767d">Generated: ${new Date().toISOString()} | ${messages.length} messages</p>
  ${rows}
</body>
</html>`;
  }
}
