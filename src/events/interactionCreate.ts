import { ChannelType, Guild, PermissionFlagsBits } from 'discord.js';

export async function setupEventTeamRoles(guild: Guild) {
  const roleNames = [
    '🎉 مدير الفعاليات',
    '🎪 منظم فعاليات',
    '🎮 منظم مسابقات',
    '🎁 مسؤول الجوائز',
    '📢 مسؤول إعلانات الفعاليات',
  ];

  for (const name of roleNames) {
    const existing = guild.roles.cache.find((role) => role.name === name);
    if (!existing) {
      await guild.roles.create({
        name,
        color: '#FFB000',
        reason: 'إنشاء أدوار فريق الفعاليات',
      });
    }
  }
}

export async function setupEventCategoryAndChannels(guild: Guild) {
  const categoryName = '🎉・الفعاليات';
  let category = guild.channels.cache.find((channel) => channel.name === categoryName && channel.type === ChannelType.GuildCategory);
  if (!category) {
    category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
      reason: 'إنشاء قسم الفعاليات',
    });
  }

  const channels = [
    '📢・إعلانات-الفعاليات',
    '💡・اقتراحات-الفعاليات',
    '🎉・الفعاليات',
    '🏆・نتائج-الفعاليات',
    '🎁・جوائز-الفعاليات',
    '🔒・فريق-الفعاليات',
    '🔊・اجتماع-الفعاليات',
    '🎤・فعالية-1',
    '🎤・فعالية-2',
    '📋・لوق-الفعاليات',
  ];

  for (const name of channels) {
    const exists = guild.channels.cache.find((channel) => channel.name === name);
    if (!exists) {
      await guild.channels.create({
        name,
        type: name.includes('🔊・') || name.includes('🎤・') ? ChannelType.GuildVoice : ChannelType.GuildText,
        parent: category.id,
        reason: 'إنشاء قنوات الفعاليات',
      });
    }
  }
}

export async function setupServerDefaults(guild: Guild) {
  await setupEventTeamRoles(guild);
  await setupEventCategoryAndChannels(guild);
}
