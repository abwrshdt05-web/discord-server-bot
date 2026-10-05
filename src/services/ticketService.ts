import { PermissionFlagsBits, TextChannel, Guild, User } from 'discord.js';
import { prisma } from '../db/client';

export async function getNextTicketNumber(guildId: string) {
  const count = await prisma.ticket.count({
    where: { guildId },
  });

  return count + 1;
}

export async function findTicketByChannelId(guildId: string, channelId: string) {
  return prisma.ticket.findFirst({
    where: {
      guildId,
      channelId,
    },
  });
}

export async function createTicketRecord({
  guildId,
  channelId,
  creatorId,
  ticketType,
  number,
}: {
  guildId: string;
  channelId: string;
  creatorId: string;
  ticketType: string;
  number: number;
}) {
  return prisma.ticket.create({
    data: {
      guildId,
      channelId,
      creatorId,
      ticketType,
      number,
      status: 'open',
    },
  });
}

export async function closeTicketRecord(ticketId: string) {
  return prisma.ticket.update({
    where: { id: ticketId },
    data: { status: 'closed' },
  });
}

export async function reopenTicketRecord(ticketId: string) {
  return prisma.ticket.update({
    where: { id: ticketId },
    data: { status: 'open' },
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

export function getStaffRoles(guild: Guild) {
  return guild.roles.cache.filter((role) =>
    role.permissions.has(PermissionFlagsBits.ManageChannels) ||
    role.permissions.has(PermissionFlagsBits.BanMembers) ||
    role.permissions.has(PermissionFlagsBits.KickMembers) ||
    role.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

export async function createTicketChannel({
  guild,
  creator,
  type,
  categoryId,
  number,
}: {
  guild: Guild;
  creator: User;
  type: string;
  categoryId?: string;
  number: number;
}) {
  const roleEveryone = guild.roles.everyone;
  const staffRoles = getStaffRoles(guild);

  const channel = await guild.channels.create({
    name: `ticket-${number}`,
    type: 0,
    parent: categoryId || undefined,
    permissionOverwrites: [
      {
        id: roleEveryone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: creator.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
        ],
      },
      ...staffRoles.map((role) => ({
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
        ],
      })),
    ],
  });

  await channel.send({
    content: `Hello ${creator}! Your ticket has been created.\nType: **${type}**\nTicket number: **#${number}**`,
  });

  return channel as TextChannel;
}

export async function generateTicketTranscript(channel: TextChannel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const sorted = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const transcript = sorted
    .map((msg) => `${new Date(msg.createdTimestamp).toISOString()} | ${msg.author.tag} | ${msg.content || '[embed/attachment]'}`)
    .join('\n');

  const chunk = transcript.slice(0, 1900) || 'No messages in this ticket.';

  return chunk;
}
