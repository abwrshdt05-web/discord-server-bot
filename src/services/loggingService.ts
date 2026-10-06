import { Message, EmbedBuilder, Guild } from 'discord.js';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';

export type LogType =
  | 'general'
  | 'messages'
  | 'members'
  | 'voice'
  | 'roles'
  | 'channels'
  | 'moderation'
  | 'tickets'
  | 'levels';

async function getLogChannel(guild: Guild, type: LogType) {
  const settings = await prisma.logSetting.upsert({
    where: { guildId: guild.id },
    update: {},
    create: { guildId: guild.id },
  });

  let channelId: string | null = null;

  switch (type) {
    case 'general':
      channelId = settings.generalChannelId ?? settings.messageChannelId ?? null;
      break;
    case 'messages':
      channelId = settings.messageChannelId ?? settings.generalChannelId ?? null;
      break;
    case 'members':
      channelId = settings.memberChannelId ?? settings.generalChannelId ?? null;
      break;
    case 'voice':
      channelId = settings.voiceChannelId ?? settings.generalChannelId ?? null;
      break;
    case 'roles':
      channelId = settings.roleChannelId ?? settings.generalChannelId ?? null;
      break;
    case 'channels':
      channelId = settings.channelChannelId ?? settings.generalChannelId ?? null;
      break;
    case 'moderation':
      channelId = settings.moderationChannelId ?? settings.generalChannelId ?? null;
      break;
    case 'tickets':
      channelId = settings.ticketChannelId ?? settings.generalChannelId ?? null;
      break;
    case 'levels':
      channelId = settings.levelChannelId ?? settings.generalChannelId ?? null;
      break;
  }

  if (!channelId) return null;
  return guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
}

export async function sendLogEmbed(guild: Guild, type: LogType, title: string, description: string, fields: { name: string; value: string; inline?: boolean }[] = []) {
  const channel = await getLogChannel(guild, type);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  if (fields.length) embed.addFields(fields);

  await channel.send({ embeds: [embed] }).catch((error) => {
    logger.warn(`Could not send ${type} log: ${error.message}`);
  });
}

export async function logMessageDelete(guild: Guild, message: Message, deletedBy?: string) {
  const content = message.content || '[لا يوجد محتوى نصي]';
  const actor = deletedBy ? `<@${deletedBy}>` : 'Discord';

  await sendLogEmbed(guild, 'messages', '🗑️ رسالة تم حذفها', `**العضو:** <@${message.author.id}>\n**القناة:** <#${message.channelId}>\n**حذف بواسطة:** ${actor}`, [
    { name: 'المحتوى', value: content.length > 1024 ? `${content.slice(0, 1021)}...` : content, inline: false },
    { name: 'نوع الرسالة', value: message.attachments.size > 0 ? 'مرفقات' : 'نص', inline: true },
  ]);
}

export async function logMessageEdit(guild: Guild, oldMessage: Message, newMessage: Message) {
  const oldContent = oldMessage.content || '[لا يوجد محتوى نصي]';
  const newContent = newMessage.content || '[لا يوجد محتوى نصي]';

  await sendLogEmbed(guild, 'messages', '✏️ رسالة تم تعديلها', `**العضو:** <@${newMessage.author.id}>\n**القناة:** <#${newMessage.channelId}>`, [
    { name: 'قبل', value: oldContent.length > 900 ? `${oldContent.slice(0, 897)}...` : oldContent, inline: false },
    { name: 'بعد', value: newContent.length > 900 ? `${newContent.slice(0, 897)}...` : newContent, inline: false },
  ]);
}

export async function logMemberJoin(guild: Guild, userId: string) {
  await sendLogEmbed(guild, 'members', '📥 دخول عضو', `**العضو:** <@${userId}>\n**عدد الأعضاء:** ${guild.memberCount}`, [
    { name: 'معرف العضو', value: userId, inline: true },
  ]);
}

export async function logMemberLeave(guild: Guild, userId: string) {
  await sendLogEmbed(guild, 'members', '📤 خروج عضو', `**العضو:** <@${userId}>`, [
    { name: 'معرف العضو', value: userId, inline: true },
  ]);
}

export async function logVoiceState(guild: Guild, userId: string, event: string, channelName?: string) {
  const map: Record<string, string> = {
    join: '🔊 دخول روم صوتي',
    leave: '🔇 خروج من روم صوتي',
    move: '🔄 انتقال روم صوتي',
    mute: '🔇 كتم صوتي',
    unmute: '🔊 فك الكتم الصوتي',
    deafen: '🎧 كتم الأذن',
    undeafen: '🔊 فك الكتم',
  };

  await sendLogEmbed(guild, 'voice', map[event] ?? '🔊 تغيير صوتي', `**العضو:** <@${userId}>${channelName ? `\n**الروم:** ${channelName}` : ''}`);
}

export async function logRoleAction(guild: Guild, action: string, targetId: string, executorId?: string) {
  await sendLogEmbed(guild, 'roles', `🎭 ${action}`, `**العضو:** <@${targetId}>${executorId ? `\n**بواسطة:** <@${executorId}>` : ''}`);
}

export async function logChannelAction(guild: Guild, action: string, channelName: string, executorId?: string) {
  await sendLogEmbed(guild, 'channels', `📁 ${action}`, `**الروم:** ${channelName}${executorId ? `\n**بواسطة:** <@${executorId}>` : ''}`);
}

export async function logModerationEvent(guild: Guild, action: string, userId: string, moderatorId: string, reason?: string, caseId?: number) {
  await sendLogEmbed(guild, 'moderation', '🛡️ إجراء إداري', `**العضو:** <@${userId}>\n**الإجراء:** ${action}\n**بواسطة:** <@${moderatorId}>${reason ? `\n**السبب:** ${reason}` : ''}`, [
    { name: 'رقم القضية', value: caseId ? `#${caseId}` : 'غير محدد', inline: true },
  ]);
}

export async function logTicketAction(guild: Guild, action: string, ticketNumber: number, userId?: string, executorId?: string) {
  await sendLogEmbed(guild, 'tickets', `🎫 ${action}`, `**رقم التذكرة:** #${ticketNumber}${userId ? `\n**المستخدم:** <@${userId}>` : ''}${executorId ? `\n**بواسطة:** <@${executorId}>` : ''}`);
}

export async function logLevelUp(guild: Guild, userId: string, oldLevel: number, newLevel: number) {
  await sendLogEmbed(guild, 'levels', '⭐ Level Up', `**العضو:** <@${userId}>\n**من:** ${oldLevel}\n**إلى:** ${newLevel}`);
}
