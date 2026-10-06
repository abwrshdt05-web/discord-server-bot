import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';
import { env } from './config/env';
import { prisma } from './db/client';
import { logger } from './utils/logger';
import { CommandHandler } from './handlers/commandHandler';
import { registerReadyEvent } from './events/ready';
import { registerInteractionCreateEvent } from './events/interactionCreate';
import { registerMessageCreateEvent } from './events/messageCreate';
import { registerMessageDeleteEvent } from './events/messageDelete';
import { registerMessageUpdateEvent } from './events/messageUpdate';
import { registerGuildMemberAddEvent } from './events/guildMemberAdd';
import { registerGuildMemberRemoveEvent } from './events/guildMemberRemove';
import { registerVoiceStateUpdateEvent } from './events/voiceStateUpdate';
import { setupStaffRoles, setupServerChannels } from './services/staffService';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.VoiceStates,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.Message],
});

const commandHandler = new CommandHandler();

async function bootstrap() {
  try {
    logger.info('🚀 جاري تشغيل البوت...');

    await commandHandler.load();
    logger.info(`✅ تم تحميل ${commandHandler.commands.size} أمر`);

    await commandHandler.registerGlobalCommands();
    logger.info('✅ تم تسجيل الأوامر العالمية');

    registerReadyEvent(client);
    registerInteractionCreateEvent(client, commandHandler);
    registerMessageCreateEvent(client);
    registerMessageDeleteEvent(client);
    registerMessageUpdateEvent(client);
    registerGuildMemberAddEvent(client);
    registerGuildMemberRemoveEvent(client);
    registerVoiceStateUpdateEvent(client);

    client.on(Events.GuildCreate, async (guild) => {
      await setupStaffRoles(guild);
      await setupServerChannels(guild);
    });

    await client.login(env.DISCORD_TOKEN);
  } catch (error) {
    logger.error('❌ فشل تشغيل البوت:', error);
    process.exit(1);
  }
}

bootstrap();

process.on('SIGINT', async () => {
  logger.info('⏹️ إيقاف البوت...');
  await client.destroy();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error('❌ خطأ غير معالج:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('❌ استثناء غير متوقع:', error);
});
