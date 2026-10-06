import { Client, Events, GuildMember, VoiceState } from 'discord.js';
import { logger } from '../utils/logger';
import { logVoiceState } from '../services/loggingService';

export function registerVoiceStateUpdateEvent(client: Client) {
  client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    try {
      if (!newState.guild || !newState.member) return;
      const userId = newState.member.id;

      if (!oldState.channel && newState.channel) {
        await logVoiceState(newState.guild, userId, 'join', newState.channel.name);
      } else if (oldState.channel && !newState.channel) {
        await logVoiceState(newState.guild, userId, 'leave', oldState.channel.name);
      } else if (oldState.channel && newState.channel && oldState.channel.id !== newState.channel.id) {
        await logVoiceState(newState.guild, userId, 'move', `${oldState.channel.name} -> ${newState.channel.name}`);
      }
    } catch (error) {
      logger.error('Error logging voice event:', error);
    }
  });
}
