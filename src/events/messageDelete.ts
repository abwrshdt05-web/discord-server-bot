import { Client, Events, Message, PartialMessage, GuildMember, VoiceState } from 'discord.js';
import { logger } from '../utils/logger';
import { logMessageDelete, logMessageEdit, logMemberJoin, logMemberLeave, logVoiceState, logRoleAction, logChannelAction } from '../services/loggingService';

export function registerMessageDeleteEvent(client: Client) {
  client.on(Events.MessageDelete, async (message: Message | PartialMessage) => {
    try {
      if (!message.guild || message.author?.bot) return;
      if (!message.author) return;
      await logMessageDelete(message.guild, message as Message, message.author.id);
    } catch (error) {
      logger.error('Error logging message delete:', error);
    }
  });
}

export function registerMessageUpdateEvent(client: Client) {
  client.on(Events.MessageUpdate, async (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
    try {
      if (!newMessage.guild || !oldMessage.guild) return;
      if (oldMessage.author?.bot || newMessage.author?.bot) return;
      if (!oldMessage.content || !newMessage.content) return;
      if (oldMessage.content === newMessage.content) return;
      await logMessageEdit(newMessage.guild, oldMessage as Message, newMessage as Message);
    } catch (error) {
      logger.error('Error logging message edit:', error);
    }
  });
}

export function registerGuildMemberAddEvent(client: Client) {
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    try {
      await logMemberJoin(member.guild, member.id);
    } catch (error) {
      logger.error('Error logging member join:', error);
    }
  });
}

export function registerGuildMemberRemoveEvent(client: Client) {
  client.on(Events.GuildMemberRemove, async (member: GuildMember) => {
    try {
      await logMemberLeave(member.guild, member.id);
    } catch (error) {
      logger.error('Error logging member leave:', error);
    }
  });
}

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
      logger.error('Error logging voice state change:', error);
    }
  });
}
