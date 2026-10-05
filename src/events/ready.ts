import { Client, Events } from 'discord.js';
import { logger } from '../utils/logger';

export function registerReadyEvent(client: Client) {
  client.on(Events.ClientReady, () => {
    logger.info(`Logged in as ${client.user?.tag}`);
  });
}
