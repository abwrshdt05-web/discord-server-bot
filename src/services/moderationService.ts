import { prisma } from '../db/client';

export async function logModerationAction({
  guildId,
  userId,
  moderatorId,
  action,
  reason,
}: {
  guildId: string;
  userId: string;
  moderatorId: string;
  action: string;
  reason?: string;
}) {
  await prisma.moderationCase.create({
    data: {
      guildId,
      userId,
      moderatorId,
      action,
      reason: reason || 'No reason provided',
    },
  });
}

export async function getGuildConfig(guildId: string) {
  return prisma.guildConfig.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });
}
