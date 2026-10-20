import { Client, Events, Message, PartialMessage } from 'discord.js';
import { logMessageDelete } from '../services/loggingService';
import { logger } from '../utils/logger';

export function registerMessageDeleteEvent(client: Client) {
  client.on(Events.MessageDelete, async (message: Message | PartialMessage) => {
    try {
      if (!message.guild || !message.author || message.author.bot) return;
      await logMessageDelete(message.guild, message as Message, message.author.id);
    } catch (error) {
      logger.error({ err: error }, 'Error logging message deletion');
    }
  });
}
