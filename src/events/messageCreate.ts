import { Client, Events, Message } from 'discord.js';
import { handleTicketMessage } from './ticketInteractions';
import { logger } from '../utils/logger';

export function registerMessageCreateEvent(client: Client) {
  client.on(Events.MessageCreate, async (message: Message) => {
    try {
      await handleTicketMessage(message);
    } catch (error) {
      logger.warn({ err: error, messageId: message.id }, 'Optional ticket message logging failed');
    }
  });
}
