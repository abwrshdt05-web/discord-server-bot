import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { prisma } from '../../db/client';

export default {
  data: new SlashCommandBuilder()
    .setName('اعداد-اللوق')
    .setDescription('إعداد قنوات اللوق للـ Discord')
    .addChannelOption((option) =>
      option.setName('القناة').setDescription('القناة المستخدمة للـ لوق الرسائل').setRequired(false)
    )
    .addStringOption((option) =>
      option.setName('النوع').setDescription('نوع اللوق').setRequired(false).addChoices(
        { name: 'عام', value: 'general' },
        { name: 'رسائل', value: 'messages' },
        { name: 'أعضاء', value: 'members' },
        { name: 'صوتي', value: 'voice' },
        { name: 'رتب', value: 'roles' },
        { name: 'رومات', value: 'channels' },
        { name: 'إداري', value: 'moderation' },
        { name: 'تذاكر', value: 'tickets' },
        { name: 'مستويات', value: 'levels' }
      )
    ),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ لا يمكن استخدام هذا الأمر خارج السيرفر', ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ ليس لديك صلاحية لإدارة لوغز السيرفر', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('القناة');
    const type = interaction.options.getString('النوع') || 'general';

    const settings = await prisma.logSetting.upsert({
      where: { guildId: interaction.guild.id },
      update: {},
      create: { guildId: interaction.guild.id },
    });

    const typeMap: Record<string, { key: string; label: string }> = {
      general: { key: 'generalChannelId', label: 'عام' },
      messages: { key: 'messageChannelId', label: 'رسائل' },
      members: { key: 'memberChannelId', label: 'أعضاء' },
      voice: { key: 'voiceChannelId', label: 'صوتي' },
      roles: { key: 'roleChannelId', label: 'رتب' },
      channels: { key: 'channelChannelId', label: 'رومات' },
      moderation: { key: 'moderationChannelId', label: 'إداري' },
      tickets: { key: 'ticketChannelId', label: 'تذاكر' },
      levels: { key: 'levelChannelId', label: 'مستويات' },
    };

    const selected = typeMap[type];
    if (channel && selected) {
      await prisma.logSetting.update({
        where: { guildId: interaction.guild.id },
        data: {
          [selected.key]: channel.id,
        },
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📋 إعدادات اللوق')
      .setDescription('تم تحديث إعدادات اللوق في السيرفر')
      .addFields(
        { name: 'النوع', value: selected?.label ?? 'عام', inline: true },
        { name: 'القناة', value: channel ? `<#${channel.id}>` : 'غير محدد', inline: true }
      );

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
