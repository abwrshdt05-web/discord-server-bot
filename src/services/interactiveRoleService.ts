import { ButtonInteraction, GuildMember, Interaction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType } from 'discord.js';
import { prisma } from '../db/client';

export async function ensureInteractiveRole(guildId: string, roleId: string, category: string, label: string, emoji?: string) {
  return prisma.interactiveRole.upsert({
    where: { guildId_roleId: { guildId, roleId } },
    update: { category, label, emoji: emoji ?? null },
    create: { guildId, roleId, category, label, emoji: emoji ?? null },
  });
}

export async function getInteractiveRoles(guildId: string, category?: string) {
  return prisma.interactiveRole.findMany({
    where: { guildId, ...(category ? { category } : {}) },
    orderBy: { createdAt: 'asc' },
  });
}

export async function toggleInteractiveRole(interaction: ButtonInteraction) {
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

export async function buildRolePanelEmbed(title: string, description: string, category: string) {
  const roles = await getInteractiveRoles(title.includes('🎮') ? 'games' : category);
  const lines = roles.length
    ? roles.map((entry) => `• ${entry.emoji ? `${entry.emoji} ` : ''}${entry.label}`).join('\n')
    : 'لا توجد رتب في هذه الفئة.';

  return new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(title)
    .setDescription(`${description}\n\n${lines}`)
    .setTimestamp();
}

export async function buildRolePanelButtons(guildId: string, category: string) {
  const roles = await getInteractiveRoles(guildId, category);
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];

  for (let i = 0; i < roles.length; i += 5) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    const slice = roles.slice(i, i + 5);
    for (const role of slice) {
      const roleObj = await guildId ? (await (await import('discord.js')).Guild.prototype.roles.fetch.call(null, role.roleId)).catch(() => null) : null;
      if (!roleObj) continue;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`role_toggle:${role.roleId}`)
          .setLabel(role.label)
          .setEmoji(role.emoji || undefined)
          .setStyle(ButtonStyle.Primary)
      );
    }
    if (row.components.length > 0) rows.push(row);
  }

  return rows;
}

export async function createInteractiveRolePanel(guild: any, category: string, title: string, description: string) {
  const roles = await getInteractiveRoles(guild.id, category);
  const row = new ActionRowBuilder<ButtonBuilder>();

  for (const role of roles) {
    const roleObj = await guild.roles.fetch(role.roleId).catch(() => null);
    if (!roleObj) continue;
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`role_toggle:${role.roleId}`)
        .setLabel(role.label)
        .setEmoji(role.emoji || undefined)
        .setStyle(ButtonStyle.Primary)
    );
  }

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(title)
    .setDescription(`${description}\n\n${roles.length ? 'اختر الرتبة المناسبة لك' : 'لا توجد رتب مفعلة في هذه الفئة'}`)
    .setTimestamp();

  return { embed, components: row.components.length ? [row] : [] };
}

export async function handleRolePanelInteraction(interaction: Interaction) {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('role_toggle:')) return;
  await toggleInteractiveRole(interaction);
}
