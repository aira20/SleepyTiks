import { EmbedBuilder } from 'discord.js';
import { Colors } from '../../types';

export function buildSuccessEmbed(title: string, message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(Colors.SUCCESS)
    .setTitle(`✅ ${title}`)
    .setDescription(message)
    .setTimestamp();
}

export function successEmbed(message: string, title = 'Success'): EmbedBuilder {
  return buildSuccessEmbed(title, message);
}
