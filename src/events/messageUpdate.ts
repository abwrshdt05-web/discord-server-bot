import { Client, Events, Message, PartialMessage } from 'discord.js';
import { logMessageEdit } from '../services/loggingService';
import { logger } from '../utils/logger';

export function registerMessageUpdateEvent(client: Client) {
  client.on(Events.MessageUpdate, async (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
    try {
      if (!oldMessage.guild || !newMessage.guild) return;
      if (!oldMessage.content || !newMessage.content) return;
      if (oldMessage.content === newMessage.content) return;
      if (oldMessage.author?.bot || newMessage.author?.bot) return;
      await logMessageEdit(newMessage.guild, oldMessage as Message, newMessage as Message);
    } catch (error) {
      logger.error({ err: error }, 'Error logging message edit');
    }
  });
}
