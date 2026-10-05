import { EmbedBuilder } from 'discord.js';

export function createEmbed(title: string, description?: string) {
  return new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(title)
    .setDescription(description || '')
    .setTimestamp();
}
