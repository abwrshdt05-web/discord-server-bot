import { prisma } from '../db/client';
import { Guild } from 'discord.js';
import { logModerationEvent } from './loggingService';
import { logger } from '../utils/logger';

export async function logModerationAction({
  guildId,
  userId,
  moderatorId,
  action,
  reason,
  guild,
}: {
  guildId: string;
  userId: string;
  moderatorId: string;
  action: string;
  reason?: string;
  guild?: Guild;
}) {
  const record = await prisma.moderationCase.create({
    data: {
      guildId,
      userId,
      moderatorId,
      action,
      reason: reason || 'No reason provided',
    },
  });
  if (guild) {
    await logModerationEvent(guild, action, userId, moderatorId, reason, record.id).catch((error) => {
      logger.warn({ err: error, guildId, caseId: record.id }, 'Could not send moderation log embed');
    });
  }
  return record;
}

export async function getGuildConfig(guildId: string) {
  return prisma.guildConfig.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });
}
