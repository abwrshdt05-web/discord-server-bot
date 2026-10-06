import { Client, Events, GuildMember } from 'discord.js';
import { logger } from '../utils/logger';
import { logMemberJoin, logMemberLeave } from '../services/loggingService';

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
