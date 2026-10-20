import { Client, Events, GuildMember, PartialGuildMember } from 'discord.js';
import { logMemberJoin, logMemberLeave } from '../services/loggingService';
import { logger } from '../utils/logger';

export function registerGuildMemberAddEvent(client: Client) {
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    try {
      await logMemberJoin(member.guild, member.id);
    } catch (error) {
      logger.error({ err: error }, 'Error logging member join');
    }
  });
}

export function registerGuildMemberRemoveEvent(client: Client) {
  client.on(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
    try {
      await logMemberLeave(member.guild, member.id);
    } catch (error) {
      logger.error({ err: error }, 'Error logging member leave');
    }
  });
}
