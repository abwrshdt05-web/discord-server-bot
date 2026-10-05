import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { env } from './config/env';
import { prisma } from './db/client';
import { logger } from './utils/logger';
import { CommandHandler } from './handlers/commandHandler';
import { registerReadyEvent } from './events/ready';
import { registerInteractionCreateEvent } from './events/interactionCreate';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.Message],
});

const commandHandler = new CommandHandler();

async function bootstrap() {
  await commandHandler.load();
  await commandHandler.registerGlobalCommands();

  registerReadyEvent(client);
  registerInteractionCreateEvent(client, commandHandler);

  client.login(env.DISCORD_TOKEN).catch((error) => {
    logger.error(error);
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  logger.error(error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  await client.destroy();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error(reason);
});

process.on('uncaughtException', (error) => {
  logger.error(error);
});
