import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction, EmbedBuilder, Guild, GuildMember, PermissionFlagsBits, Role } from 'discord.js';
import { prisma } from '../db/client';

export async function getInteractiveRoleConfig(guildId: string) {
  return prisma.interactiveRole.findMany({
    where: { guildId },
    orderBy: { category: 'asc' },
  });
}

export async function ensureInteractiveRole(guild: Guild, roleName: string, category: string, emoji = '🎉') {
  let role = guild.roles.cache.find((r) => r.name === roleName);
  if (!role) {
    role = await guild.roles.create({
      name: roleName,
      color: '#5865F2',
      reason: 'إنشاء رتبة تفاعلية تلقائياً',
    });
  }

  return prisma.interactiveRole.upsert({
    where: { guildId_roleId: { guildId: guild.id, roleId: role.id } },
    update: { category, label: roleName, emoji },
    create: { guildId: guild.id, roleId: role.id, category, label: roleName, emoji },
  });
}

export async function createRolePanel(guild: Guild, category: string, title: string, description: string) {
  const rows = new ActionRowBuilder<ButtonBuilder>();
  const roles = await prisma.interactiveRole.findMany({
    where: { guildId: guild.id, category },
    orderBy: { createdAt: 'asc' },
  });

  for (const entry of roles) {
    const role = await guild.roles.fetch(entry.roleId).catch(() => null);
    if (!role) continue;
    rows.addComponents(
      new ButtonBuilder()
        .setCustomId(`role_toggle:${entry.roleId}`)
        .setLabel(entry.label || role.name)
        .setEmoji(entry.emoji || undefined)
        .setStyle(ButtonStyle.Primary)
    );
  }

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(title)
    .setDescription(`${description}\n\n${roles.length ? 'اختر رتبة مناسبة لك' : 'لا توجد رتب مفعلة في هذه الفئة'}`)
    .setTimestamp();

  return { embed, components: rows.components.length ? [rows] : [] };
}

export async function toggleInteractiveRole(interaction: any) {
  if (!interaction.guild || !interaction.member) return;
  const [, roleId] = interaction.customId.split(':');
  const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    await interaction.reply({ content: '❌ هذه الرتبة غير موجودة.', ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember;
  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role);
    await interaction.reply({ content: `✅ تم إزالة رتبتك: ${role.name}`, ephemeral: true });
    return;
  }

  await member.roles.add(role);
  await interaction.reply({ content: `✅ تم إضافة رتبتك: ${role.name}`, ephemeral: true });
}

export async function listRoleCategories(guildId: string) {
  return prisma.interactiveRole.groupBy({
    by: ['category'],
    where: { guildId },
  });
}
