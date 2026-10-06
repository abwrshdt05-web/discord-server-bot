import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction, EmbedBuilder, Guild, GuildMember, TextChannel, User } from 'discord.js';
import { prisma } from '../db/client';

function escapeValue(value: string | undefined | null) {
  return (value || 'غير محدد').slice(0, 1000);
}

export async function logEventAction(guild: Guild, title: string, description: string) {
  const logChannel = guild.channels.cache.find((channel) => channel.name.includes('لوق-الفعاليات') || channel.name.includes('event-log'));
  if (!logChannel || !logChannel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor('#FFB000')
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
}

export async function createGuildEvent({
  guild,
  organizerId,
  name,
  description,
  scheduledAt,
  durationMinutes,
  maxParticipants,
  rewards,
  rules,
  channelId,
  imageUrl,
}: {
  guild: Guild;
  organizerId: string;
  name: string;
  description?: string;
  scheduledAt: Date;
  durationMinutes?: number;
  maxParticipants?: number;
  rewards?: string;
  rules?: string;
  channelId?: string;
  imageUrl?: string;
}) {
  const eventNumber = await prisma.guildEvent.count({ where: { guildId: guild.id } });

  return prisma.guildEvent.create({
    data: {
      guildId: guild.id,
      organizerId,
      name,
      description: description || 'لا يوجد وصف',
      scheduledAt,
      durationMinutes: durationMinutes || 60,
      maxParticipants: maxParticipants || 20,
      rewards: rewards || 'غير محدد',
      rules: rules || 'لا توجد شروط',
      channelId: channelId || null,
      imageUrl: imageUrl || null,
      status: 'scheduled',
      eventNumber: eventNumber + 1,
    },
  });
}

export async function registerEventParticipant(guildId: string, eventId: string, userId: string) {
  const existing = await prisma.guildEventParticipant.findUnique({
    where: { guildId_eventId_userId: { guildId, eventId, userId } },
  });

  if (existing) return existing;

  return prisma.guildEventParticipant.create({
    data: { guildId, eventId, userId },
  });
}

export async function getEventParticipants(eventId: string) {
  return prisma.guildEventParticipant.findMany({
    where: { eventId },
    orderBy: { joinedAt: 'asc' },
  });
}

export async function buildEventEmbed(event: any) {
  const participantCount = await prisma.guildEventParticipant.count({ where: { eventId: event.id } });

  const embed = new EmbedBuilder()
    .setColor('#00D1B2')
    .setTitle(`🎉 ${event.name}`)
    .setDescription(event.description || 'لا يوجد وصف')
    .addFields(
      { name: '📅 الموعد', value: new Date(event.scheduledAt).toLocaleString('ar-SA'), inline: true },
      { name: '⏱️ المدة', value: `${event.durationMinutes} دقيقة`, inline: true },
      { name: '👥 المشاركون', value: `${participantCount} / ${event.maxParticipants}`, inline: true },
      { name: '🎁 الجوائز', value: escapeValue(event.rewards), inline: false },
      { name: '📜 الشروط', value: escapeValue(event.rules), inline: false },
      { name: 'الحالة', value: event.status, inline: true }
    )
    .setTimestamp();

  if (event.imageUrl) embed.setImage(event.imageUrl);
  return embed;
}

export async function buildEventButtons(eventId: string) {
  const row = new ActionRowBuilder<ButtonBuilder>();
  row.addComponents(
    new ButtonBuilder().setCustomId(`event_join:${eventId}`).setLabel('✅ مشاركة').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`event_leave:${eventId}`).setLabel('❌ إلغاء المشاركة').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`event_participants:${eventId}`).setLabel('👥 المشاركون').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`event_info:${eventId}`).setLabel('ℹ️ معلومات').setStyle(ButtonStyle.Primary)
  );

  return [row];
}

export async function handleEventButton(interaction: any) {
  const [type, eventId] = interaction.customId.split(':');
  if (!eventId) return;
  const event = await prisma.guildEvent.findUnique({ where: { id: eventId } });
  if (!event) return;

  if (type === 'event_join') {
    await registerEventParticipant(interaction.guildId, event.id, interaction.user.id);
    await interaction.reply({ content: `✅ تم تسجيل مشاركتك في فعالية: ${event.name}`, ephemeral: true });
    await logEventAction(interaction.guild, '👤 مشاركة في فعالية', `المشارك: <@${interaction.user.id}>\nالفعالية: ${event.name}`);
    return;
  }

  if (type === 'event_leave') {
    await prisma.guildEventParticipant.deleteMany({
      where: { eventId: event.id, userId: interaction.user.id },
    });
    await interaction.reply({ content: `✅ تم إلغاء مشاركتك في فعالية: ${event.name}`, ephemeral: true });
    return;
  }

  if (type === 'event_info') {
    const embed = await buildEventEmbed(event);
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (type === 'event_participants') {
    const participants = await getEventParticipants(event.id);
    const names = participants.length
      ? participants.map((p) => `<@${p.userId}>`).join('\n')
      : 'لا يوجد مشاركون بعد.';
    await interaction.reply({ content: `👥 المشاركون في ${event.name}\n${names}`, ephemeral: true });
  }
}
