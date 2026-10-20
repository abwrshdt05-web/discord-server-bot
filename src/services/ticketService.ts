import {
  AttachmentBuilder,
  ChannelType,
  EmbedBuilder,
  Guild,
  GuildMember,
  Message,
  PermissionFlagsBits,
  TextChannel,
  User,
} from 'discord.js';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import {
  buildTicketTranscript,
  isTicketType,
  isTicketStaff,
  ticketChannelName,
  ticketOpenKey,
  type TicketType,
} from '../utils/ticketUtils';

export async function getTicketConfig(guildId: string) {
  return prisma.guildConfig.upsert({
    where: { guildId },
    update: {},
    create: { guildId },
  });
}

export async function getNextTicketNumber(guildId: string) {
  const latest = await prisma.ticket.aggregate({
    where: { guildId },
    _max: { number: true },
  });
  return (latest._max.number ?? 0) + 1;
}

export async function findTicketByChannelId(guildId: string, channelId: string) {
  return prisma.ticket.findFirst({ where: { guildId, channelId } });
}

export async function findOpenTicketForMember(
  guild: Guild,
  creatorId: string,
  type: TicketType,
) {
  const ticket = await prisma.ticket.findFirst({
    where: {
      guildId: guild.id,
      creatorId,
      ticketType: type,
      status: 'open',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!ticket) return null;

  const channel = await guild.channels.fetch(ticket.channelId).catch(() => null);
  if (channel?.type === ChannelType.GuildText) return { ticket, channel };

  // A manually deleted channel should not permanently block the member from opening a ticket.
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: 'closed', openKey: null, closedAt: new Date() },
  });
  return null;
}

export async function createTicketRecord({
  guildId,
  channelId,
  creatorId,
  ticketType,
  number,
  allowDuplicate = false,
}: {
  guildId: string;
  channelId: string;
  creatorId: string;
  ticketType: TicketType;
  number: number;
  allowDuplicate?: boolean;
}) {
  return prisma.ticket.create({
    data: {
      guildId,
      channelId,
      creatorId,
      ticketType,
      number,
      status: 'open',
      openKey: allowDuplicate ? null : ticketOpenKey(guildId, creatorId, ticketType),
    },
  });
}

export async function closeTicketRecord(ticketId: string) {
  return prisma.ticket.update({
    where: { id: ticketId },
    data: { status: 'closed', openKey: null, closedAt: new Date() },
  });
}

export async function reopenTicketRecord(ticketId: string, allowDuplicate = false) {
  const ticket = await prisma.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  return prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: 'open',
      closedAt: null,
      openKey: allowDuplicate
        ? null
        : ticketOpenKey(ticket.guildId, ticket.creatorId, ticket.ticketType as TicketType),
    },
  });
}

export async function claimTicketRecord(ticketId: string, assigneeId: string) {
  return prisma.ticket.update({
    where: { id: ticketId },
    data: { assigneeId },
  });
}

export async function listTicketsForGuild(guildId: string) {
  return prisma.ticket.findMany({
    where: { guildId },
    orderBy: { createdAt: 'desc' },
  });
}

export function getStaffRoleIds(guild: Guild, configuredRoleIds: readonly string[] = []) {
  const ids = new Set(configuredRoleIds);
  for (const role of guild.roles.cache.values()) {
    if (
      role.permissions.has(PermissionFlagsBits.Administrator) ||
      role.permissions.has(PermissionFlagsBits.ManageGuild)
    ) {
      ids.add(role.id);
    }
  }
  return [...ids].filter((id) => id !== guild.roles.everyone.id && guild.roles.cache.has(id));
}

export function canManageTicket(member: GuildMember, guild: Guild, configuredRoleIds: readonly string[]) {
  return isTicketStaff({
    userId: member.id,
    ownerId: guild.ownerId,
    hasAdministrator: member.permissions.has(PermissionFlagsBits.Administrator),
    hasManageGuild: member.permissions.has(PermissionFlagsBits.ManageGuild),
    roleIds: [...member.roles.cache.keys()],
    staffRoleIds: getStaffRoleIds(guild, configuredRoleIds),
  });
}

export async function createTicketChannel({
  guild,
  creator,
  type,
  categoryId,
  staffRoleIds,
  number,
}: {
  guild: Guild;
  creator: User;
  type: TicketType;
  categoryId?: string | null;
  staffRoleIds: readonly string[];
  number: number;
}) {
  const permissions = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: creator.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
  ];

  for (const roleId of getStaffRoleIds(guild, staffRoleIds)) {
    permissions.push({
      id: roleId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
      ],
    });
  }

  const botId = guild.client.user?.id;
  if (botId) {
    permissions.push({
      id: botId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    });
  }

  return guild.channels.create({
    name: ticketChannelName(type, creator.username, number),
    type: ChannelType.GuildText,
    parent: categoryId ?? undefined,
    permissionOverwrites: permissions,
    reason: `إنشاء تذكرة ${type} للعضو ${creator.id}`,
  });
}

export function isTicketTextChannel(
  channel: unknown,
): channel is TextChannel {
  return Boolean(
    channel &&
      typeof channel === 'object' &&
      'type' in channel &&
      (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement),
  );
}

async function getTicketLogChannel(guild: Guild) {
  const config = await getTicketConfig(guild.id);
  const logSettings = await prisma.logSetting.findUnique({ where: { guildId: guild.id } });
  const configuredId = config.ticketLogChannelId ?? logSettings?.ticketChannelId;

  if (configuredId) {
    const configured = await guild.channels.fetch(configuredId).catch(() => null);
    if (
      isTicketTextChannel(configured) &&
      configured.permissionsFor(guild.roles.everyone) &&
      !configured.permissionsFor(guild.roles.everyone)!.has(PermissionFlagsBits.ViewChannel)
    ) {
      return configured;
    }
  }

  const names = new Set(['لوق-التكتات', 'لوق التكتات', 'سجلات-التكتات', 'سجلات التكتات']);
  const found = guild.channels.cache.find(
    (channel) => names.has(channel.name) && isTicketTextChannel(channel),
  );
  return isTicketTextChannel(found) &&
    Boolean(found.permissionsFor(guild.roles.everyone)) &&
    !found.permissionsFor(guild.roles.everyone)!.has(PermissionFlagsBits.ViewChannel)
    ? found
    : null;
}

export async function sendTicketLog(
  guild: Guild,
  title: string,
  description: string,
  transcript?: AttachmentBuilder,
) {
  try {
    const channel = await getTicketLogChannel(guild);
    if (!channel) {
      logger.warn({ guildId: guild.id }, 'Ticket log channel is not configured or available');
      return false;
    }

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(title.slice(0, 256))
      .setDescription(description.slice(0, 4000))
      .setTimestamp();

    await channel.send({
      embeds: [embed],
      files: transcript ? [transcript] : [],
      allowedMentions: { parse: [] },
    });
    return true;
  } catch (error) {
    logger.warn({ err: error, guildId: guild.id }, 'Could not send ticket log');
    return false;
  }
}

export async function generateTicketTranscript(channel: TextChannel) {
  const entries: Array<{
    author: string;
    content: string;
    timestamp: number;
    attachments: string[];
  }> = [];
  let before: string | undefined;

  // Discord limits each request to 100 messages. Cap transcript work to 2,000 messages.
  for (let page = 0; page < 20; page += 1) {
    const batch = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (batch.size === 0) break;

    for (const message of batch.values()) {
      const embedSummary = message.embeds
        .map((embed) => [embed.title, embed.description].filter(Boolean).join(': '))
        .filter(Boolean)
        .join(' | ');
      entries.push({
        author: `${message.author.tag} (${message.author.id})`,
        content: [message.content, embedSummary].filter(Boolean).join('\n'),
        timestamp: message.createdTimestamp,
        attachments: [...message.attachments.values()].map((attachment) => attachment.url),
      });
    }

    const oldest = [...batch.values()].reduce((candidate, message) =>
      message.createdTimestamp < candidate.createdTimestamp ? message : candidate,
    );
    before = oldest.id;
    if (batch.size < 100) break;
  }

  return buildTicketTranscript(entries);
}

export function makeTicketTranscriptAttachment(transcript: string, number: number) {
  const safeNumber = Math.max(0, number);
  return new AttachmentBuilder(Buffer.from(transcript, 'utf8'), {
    name: `ticket-${safeNumber}-transcript.txt`,
  });
}

export async function logTicketMessage(guild: Guild, channel: TextChannel, message: Message) {
  const config = await getTicketConfig(guild.id);
  if (!config.ticketMessageLoggingEnabled || message.author.bot) return;

  const ticket = await findTicketByChannelId(guild.id, channel.id);
  if (!ticket || ticket.status !== 'open') return;

  const content = message.content.trim() || '[مرفق أو رسالة بدون نص]';
  const safeContent = content.length > 900 ? `${content.slice(0, 897)}...` : content;
  await sendTicketLog(
    guild,
    '💬 رسالة جديدة في تذكرة',
    `**التذكرة:** <#${ticket.channelId}> (#${ticket.number})\n**العضو:** <@${message.author.id}>\n**الرسالة:** ${safeContent}`,
  );
}
