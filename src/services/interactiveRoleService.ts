import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  Guild,
  GuildMember,
  Interaction,
} from 'discord.js';
import { prisma } from '../db/client';

export async function ensureInteractiveRole(
  guild: Guild,
  roleName: string,
  category: string,
  emoji = '🎉',
) {
  let role = guild.roles.cache.find((candidate) => candidate.name === roleName);
  if (!role) {
    role = await guild.roles.create({
      name: roleName,
      color: '#5865F2',
      reason: 'إنشاء رتبة تفاعلية حسب طلب الإدارة',
    });
  }

  return prisma.interactiveRole.upsert({
    where: { guildId_roleId: { guildId: guild.id, roleId: role.id } },
    update: { category, label: roleName, emoji },
    create: { guildId: guild.id, roleId: role.id, category, label: roleName, emoji },
  });
}

export async function getInteractiveRoles(guildId: string, category?: string) {
  return prisma.interactiveRole.findMany({
    where: { guildId, ...(category ? { category } : {}) },
    orderBy: { createdAt: 'asc' },
  });
}

export async function toggleInteractiveRole(interaction: ButtonInteraction) {
  if (!interaction.guild) return;

  const [, roleId] = interaction.customId.split(':');
  const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
  if (!role) {
    await interaction.reply({ content: '❌ هذه الرتبة غير موجودة.', ephemeral: true });
    return;
  }

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) {
    await interaction.reply({ content: '❌ تعذر العثور على عضويتك.', ephemeral: true });
    return;
  }
  if (member.roles.cache.has(role.id)) {
    await member.roles.remove(role);
    await interaction.reply({ content: `✅ تم إزالة رتبتك: ${role.name}`, ephemeral: true });
    return;
  }

  await member.roles.add(role);
  await interaction.reply({ content: `✅ تم إضافة رتبتك: ${role.name}`, ephemeral: true });
}

export async function buildRolePanelEmbed(
  guild: Guild,
  title: string,
  description: string,
  category: string,
) {
  const roles = await getInteractiveRoles(guild.id, category);
  const lines = roles.length
    ? roles.map((entry) => `• ${entry.emoji ? `${entry.emoji} ` : ''}${entry.label ?? 'رتبة'}`).join('\n')
    : 'لا توجد رتب في هذه الفئة.';

  return new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(title)
    .setDescription(`${description}\n\n${lines}`)
    .setTimestamp();
}

export async function buildRolePanelButtons(guild: Guild, category: string) {
  const roles = await getInteractiveRoles(guild.id, category);
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  for (let index = 0; index < roles.length; index += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const entry of roles.slice(index, index + 5)) {
      const role = await guild.roles.fetch(entry.roleId).catch(() => null);
      if (!role) continue;
      const button = new ButtonBuilder()
        .setCustomId(`role_toggle:${entry.roleId}`)
        .setLabel(entry.label ?? role.name)
        .setStyle(ButtonStyle.Primary);
      if (entry.emoji) button.setEmoji(entry.emoji);
      row.addComponents(button);
    }
    if (row.components.length) rows.push(row);
  }
  return rows;
}

export async function createInteractiveRolePanel(
  guild: Guild,
  category: string,
  title: string,
  description: string,
) {
  const embed = await buildRolePanelEmbed(guild, title, description, category);
  const components = await buildRolePanelButtons(guild, category);
  return { embed, components };
}

export async function createRolePanel(
  guild: Guild,
  category: string,
  title: string,
  description: string,
) {
  return createInteractiveRolePanel(guild, category, title, description);
}

export async function handleRolePanelInteraction(interaction: Interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('role_toggle:')) return;
  await toggleInteractiveRole(interaction);
}
