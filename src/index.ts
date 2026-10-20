import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { env } from './config/env';
import { prisma } from './db/client';
import { CommandHandler } from './handlers/commandHandler';
import { registerGuildMemberAddEvent, registerGuildMemberRemoveEvent } from './events/guildMemberAdd';
import { registerInteractionCreateEvent } from './events/interactionCreate';
import { registerMessageCreateEvent } from './events/messageCreate';
import { registerMessageDeleteEvent } from './events/messageDelete';
import { registerMessageUpdateEvent } from './events/messageUpdate';
import { registerReadyEvent } from './events/ready';
import { registerVoiceStateUpdateEvent } from './events/voiceStateUpdate';
import { logger } from './utils/logger';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.Message],
});

const commandHandler = new CommandHandler();
let shuttingDown = false;

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ exitCode }, 'Shutting down Discord bot');

  try {
    client.destroy();
    await prisma.$disconnect();
  } catch (error) {
    logger.error({ err: error }, 'Error during graceful shutdown');
    exitCode = 1;
  } finally {
    process.exit(exitCode);
  }
}

async function bootstrap() {
  logger.info('Starting Discord bot');
  await commandHandler.load();
  logger.info({ commandCount: commandHandler.commands.size }, 'Slash commands loaded');
  await commandHandler.registerGlobalCommands();

  registerReadyEvent(client);
  registerInteractionCreateEvent(client, commandHandler);
  registerMessageCreateEvent(client);
  registerMessageDeleteEvent(client);
  registerMessageUpdateEvent(client);
  registerGuildMemberAddEvent(client);
  registerGuildMemberRemoveEvent(client);
  registerVoiceStateUpdateEvent(client);

  client.on(Events.Error, (error) => logger.error({ err: error }, 'Discord client error'));
  client.on(Events.Warn, (warning) => logger.warn({ warning }, 'Discord client warning'));
  client.on(Events.ShardDisconnect, (event, shardId) =>
    logger.warn({ shardId, code: event.code, reason: event.reason }, 'Discord shard disconnected; client will reconnect'),
  );
  client.on(Events.ShardReconnecting, (shardId) => logger.info({ shardId }, 'Discord shard reconnecting'));

  await client.login(env.DISCORD_TOKEN);
}

void bootstrap().catch(async (error) => {
  logger.error({ err: error }, 'Bot startup failed');
  await shutdown(1);
});

process.once('SIGINT', () => void shutdown(0));
process.once('SIGTERM', () => void shutdown(0));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});
process.once('uncaughtException', (error) => {
  logger.error({ err: error }, 'Uncaught exception; shutting down');
  void shutdown(1);
});
