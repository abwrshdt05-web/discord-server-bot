import { Client, Events, Message, PartialMessage } from 'discord.js';
import { logger } from '../utils/logger';
import { logMessageDelete, logMessageEdit } from '../services/loggingService';

export function registerMessageDeleteEvent(client: Client) {
  client.on(Events.MessageDelete, async (message: Message | PartialMessage) => {
    try {
      if (!message.guild || !message.author || message.author.bot) return;
      await logMessageDelete(message.guild, message as Message, undefined);
    } catch (error) {
      logger.error('Error logging deleted message:', error);
    }
  });
}

export function registerMessageUpdateEvent(client: Client) {
  client.on(Events.MessageUpdate, async (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) => {
    try {
      if (!oldMessage.guild || !newMessage.guild) return;
      if (!oldMessage.content || !newMessage.content) return;
      if (oldMessage.content === newMessage.content) return;
      if (oldMessage.author?.bot || newMessage.author?.bot) return;
      await logMessageEdit(newMessage.guild, oldMessage as Message, newMessage as Message);
    } catch (error) {
      logger.error('Error logging edited message:', error);
    }
  });
}
