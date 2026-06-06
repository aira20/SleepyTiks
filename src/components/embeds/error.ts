import { EmbedBuilder } from 'discord.js';
import { Colors } from '../../types';

export function buildErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.DANGER)
    .setTitle('❌ Error')
    .setDescription(message)
    .setTimestamp();
}

export const errorEmbed = buildErrorEmbed;
