import {
  ChannelType,
  Guild,
  GuildBasedChannel,
  PermissionFlagsBits,
  TextChannel,
  VoiceChannel,
} from 'discord.js';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';

export const DESIRED_CHANNEL_STRUCTURE = [
  {
    category: 'المعلومات',
    channels: [
      ['الإعلانات', ChannelType.GuildText],
      ['القوانين', ChannelType.GuildText],
      ['معلومات السيرفر', ChannelType.GuildText],
      ['السحوبات', ChannelType.GuildText],
      ['الترحيب', ChannelType.GuildText],
    ],
  },
  {
    category: 'المجتمع',
    channels: [
      ['الشات العام', ChannelType.GuildText],
      ['أوامر البوت', ChannelType.GuildText],
      ['الميمز', ChannelType.GuildText],
      ['الصور والمقاطع', ChannelType.GuildText],
      ['الاقتراحات', ChannelType.GuildText],
      ['البحث عن فريق', ChannelType.GuildText],
    ],
  },
  {
    category: 'المستويات',
    channels: [
      ['تسجيلات الترقية', ChannelType.GuildText],
      ['قائمة المتصدرين', ChannelType.GuildText],
      ['إحصائيات النشاط', ChannelType.GuildText],
    ],
  },
  {
    category: 'الدعم الفني',
    channels: [
      ['فتح تذكرة', ChannelType.GuildText],
      ['سجلات التكتات', ChannelType.GuildText],
      ['التكتات المغلقة', ChannelType.GuildText],
    ],
  },
  {
    category: 'الفعاليات',
    channels: [
      ['إعلانات الفعاليات', ChannelType.GuildText],
      ['اقتراحات الفعاليات', ChannelType.GuildText],
      ['نتائج الفعاليات', ChannelType.GuildText],
      ['جوائز الفعاليات', ChannelType.GuildText],
      ['شات فريق الفعاليات', ChannelType.GuildText],
    ],
  },
  {
    category: 'الإدارة',
    channels: [
      ['شات الإدارة', ChannelType.GuildText],
      ['اجتماعات الإدارة', ChannelType.GuildText],
      ['تقارير الإدارة', ChannelType.GuildText],
    ],
  },
  {
    category: 'اللوقات',
    channels: [
      ['لوق الرسائل', ChannelType.GuildText],
      ['لوق الأعضاء', ChannelType.GuildText],
      ['لوق الصوتيات', ChannelType.GuildText],
      ['لوق الرتب', ChannelType.GuildText],
      ['لوق الرومات', ChannelType.GuildText],
      ['لوق العقوبات', ChannelType.GuildText],
      ['لوق البوت', ChannelType.GuildText],
      ['لوق الفعاليات', ChannelType.GuildText],
      ['لوق التكتات', ChannelType.GuildText],
    ],
  },
  {
    category: 'الرومات الصوتية',
    channels: [
      ['صوتي العام', ChannelType.GuildVoice],
      ['صوتي الألعاب', ChannelType.GuildVoice],
      ['صوتي الفعاليات', ChannelType.GuildVoice],
      ['صوتي الإدارة', ChannelType.GuildVoice],
    ],
  },
] as const;

export type ChannelCleanupPlan = {
  missingCategories: string[];
  missingChannels: Array<{ category: string; name: string }>;
  duplicates: Array<{ name: string; channels: GuildBasedChannel[] }>;
  protectedTicketIds: Set<string>;
};

const pendingDeletions = new Map<string, { userId: string; guildId: string; expiresAt: number }>();

export function normalizeChannelName(name: string) {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/ـ/g, '')
    .toLocaleLowerCase('ar')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function getPrivateOverwrites(guild: Guild) {
  const permissions = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    ...guild.roles.cache
      .filter(
        (role) =>
          role.id !== guild.roles.everyone.id &&
          (role.permissions.has(PermissionFlagsBits.Administrator) ||
            role.permissions.has(PermissionFlagsBits.ManageGuild)),
      )
      .map((role) => ({
        id: role.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      })),
  ];
  const botId = guild.client.user?.id;
  if (botId) {
    permissions.push({
      id: botId,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
      ],
    });
  }
  return permissions;
}

function isCategory(channel: GuildBasedChannel): boolean {
  return channel.type === ChannelType.GuildCategory;
}

function isPrivateArea(category: string, channelName?: string) {
  const privateCategories = new Set([normalizeChannelName('الإدارة'), normalizeChannelName('اللوقات')]);
  const privateChannels = new Set([
    normalizeChannelName('سجلات التكتات'),
    normalizeChannelName('التكتات المغلقة'),
  ]);
  return (
    privateCategories.has(normalizeChannelName(category)) ||
    (channelName !== undefined &&
      (privateCategories.has(normalizeChannelName(category)) ||
        privateChannels.has(normalizeChannelName(channelName)) ||
        normalizeChannelName(channelName).startsWith(normalizeChannelName('لوق'))))
  );
}

export async function previewChannelCleanup(guild: Guild): Promise<ChannelCleanupPlan> {
  await guild.channels.fetch().catch((error) => {
    logger.warn({ err: error, guildId: guild.id }, 'Could not refresh all guild channels for cleanup preview');
  });
  const channels = [...guild.channels.cache.values()];
  const desiredCategoryNames = DESIRED_CHANNEL_STRUCTURE.map((entry) => normalizeChannelName(entry.category));
  const missingCategories = DESIRED_CHANNEL_STRUCTURE
    .filter(
      (entry) =>
        !channels.some(
          (channel) => isCategory(channel) && normalizeChannelName(channel.name) === normalizeChannelName(entry.category),
        ),
    )
    .map((entry) => entry.category);

  const missingChannels: Array<{ category: string; name: string }> = [];
  for (const entry of DESIRED_CHANNEL_STRUCTURE) {
    const categoryExists = channels.some(
      (channel) => isCategory(channel) && normalizeChannelName(channel.name) === normalizeChannelName(entry.category),
    );
    if (!categoryExists && !desiredCategoryNames.includes(normalizeChannelName(entry.category))) continue;

    for (const [name, type] of entry.channels) {
      const exists = channels.some(
        (channel) =>
          !isCategory(channel) &&
          channel.type === type &&
          normalizeChannelName(channel.name) === normalizeChannelName(name),
      );
      if (!exists) missingChannels.push({ category: entry.category, name });
    }
  }

  const groups = new Map<string, GuildBasedChannel[]>();
  for (const channel of channels) {
    const key = `${channel.type}:${normalizeChannelName(channel.name)}`;
    const group = groups.get(key) ?? [];
    group.push(channel);
    groups.set(key, group);
  }
  const duplicates = [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({ name: group[0].name, channels: group }));

  const tickets = await prisma.ticket.findMany({
    where: { guildId: guild.id },
    select: { channelId: true },
  });
  return {
    missingCategories,
    missingChannels,
    duplicates,
    protectedTicketIds: new Set(tickets.map((ticket) => ticket.channelId)),
  };
}

export async function applyMissingChannelStructure(guild: Guild) {
  const plan = await previewChannelCleanup(guild);
  const createdCategories: string[] = [];
  const createdChannels: string[] = [];
  const categoryIds = new Map<string, string>();

  for (const entry of DESIRED_CHANNEL_STRUCTURE) {
    const existing = guild.channels.cache.find(
      (channel) =>
        isCategory(channel) && normalizeChannelName(channel.name) === normalizeChannelName(entry.category),
    );
    const category =
      existing?.type === ChannelType.GuildCategory
        ? existing
        : await guild.channels.create({
            name: entry.category,
            type: ChannelType.GuildCategory,
            ...(isPrivateArea(entry.category) ? { permissionOverwrites: getPrivateOverwrites(guild) } : {}),
            reason: 'إنشاء البنية العربية الأساسية للقنوات',
          });
    categoryIds.set(entry.category, category.id);
    if (!existing) createdCategories.push(entry.category);
  }

  for (const entry of DESIRED_CHANNEL_STRUCTURE) {
    const parent = categoryIds.get(entry.category);
    if (!parent) continue;
    for (const [name, type] of entry.channels) {
      const existing = guild.channels.cache.find(
        (channel) =>
          !isCategory(channel) &&
          channel.type === type &&
          normalizeChannelName(channel.name) === normalizeChannelName(name),
      );
      if (existing) continue;
      await guild.channels.create({
        name,
        type,
        parent,
        ...(isPrivateArea(entry.category, name) ? { permissionOverwrites: getPrivateOverwrites(guild) } : {}),
        reason: 'إضافة قناة مفقودة إلى البنية العربية الأساسية',
      });
      createdChannels.push(`${entry.category} / ${name}`);
    }
  }

  return { ...plan, createdCategories, createdChannels };
}

async function isStillSafeToDelete(guild: Guild, channel: GuildBasedChannel) {
  if (channel.type === ChannelType.GuildCategory) return { safe: false, reason: 'لا يمكن حذف تصنيف من هذه الأداة.' };
  const ticket = await prisma.ticket.findFirst({
    where: { guildId: guild.id, channelId: channel.id },
    select: { id: true },
  });
  if (ticket) return { safe: false, reason: 'القناة مرتبطة بسجل تذكرة؛ لن تُحذف.' };

  const duplicate = guild.channels.cache.find(
    (other) =>
      other.id !== channel.id &&
      other.type === channel.type &&
      normalizeChannelName(other.name) === normalizeChannelName(channel.name),
  );
  if (!duplicate) return { safe: false, reason: 'لم يعد هناك تكرار مطابق للقناة.' };

  if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
    const textChannel = channel as TextChannel;
    const messages = await textChannel.messages.fetch({ limit: 1 }).catch(() => null);
    if (!messages) return { safe: false, reason: 'تعذر فحص محتوى القناة؛ لم تُحذف.' };
    if (messages.size > 0) return { safe: false, reason: 'تحتوي القناة على رسائل؛ لن تُحذف تلقائيًا.' };
    return { safe: true, reason: 'قناة مكررة ولا تحتوي على رسائل أو سجل تذكرة.' };
  }

  if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
    const voiceChannel = channel as VoiceChannel;
    if (voiceChannel.members.size > 0) return { safe: false, reason: 'يوجد أعضاء متصلون بالقناة.' };
    return { safe: true, reason: 'قناة صوتية مكررة ولا يوجد أعضاء متصلون بها.' };
  }

  return { safe: false, reason: 'نوع القناة غير مدعوم للحذف الآمن.' };
}

export async function requestDuplicateChannelDeletion(
  guild: Guild,
  channel: GuildBasedChannel,
  userId: string,
) {
  const check = await isStillSafeToDelete(guild, channel);
  if (!check.safe) return check;

  const key = `${guild.id}:${userId}:${channel.id}`;
  pendingDeletions.set(key, { userId, guildId: guild.id, expiresAt: Date.now() + 60_000 });
  return { ...check, confirmationId: `channel-delete-confirm:${userId}:${channel.id}` };
}

export async function confirmDuplicateChannelDeletion(
  guild: Guild,
  channelId: string,
  userId: string,
) {
  const key = `${guild.id}:${userId}:${channelId}`;
  const pending = pendingDeletions.get(key);
  pendingDeletions.delete(key);
  if (!pending || pending.expiresAt < Date.now()) {
    return { deleted: false, reason: 'انتهت مهلة التأكيد. شغّل المعاينة مرة أخرى.' };
  }

  const member = await guild.members.fetch(userId).catch(() => null);
  if (
    !member ||
    (!member.permissions.has(PermissionFlagsBits.ManageChannels) &&
      !member.permissions.has(PermissionFlagsBits.Administrator))
  ) {
    return { deleted: false, reason: 'تحتاج صلاحية إدارة القنوات.' };
  }
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel) return { deleted: false, reason: 'القناة لم تعد موجودة.' };

  const check = await isStillSafeToDelete(guild, channel);
  if (!check.safe) return { deleted: false, reason: check.reason };

  await channel.delete('تأكيد صريح من المدير لحذف قناة مكررة وفارغة');
  return { deleted: true, reason: `حُذفت القناة #${channel.name} بعد إعادة فحصها.` };
}
