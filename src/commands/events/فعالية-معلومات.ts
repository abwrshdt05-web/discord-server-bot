import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createGuildEvent, buildEventEmbed, buildEventButtons, logEventAction } from '../../services/eventService';

export default {
  data: new SlashCommandBuilder()
    .setName('فعالية-إنشاء')
    .setDescription('إنشاء فعالية جديدة')
    .addStringOption((option) => option.setName('الاسم').setDescription('اسم الفعالية').setRequired(true))
    .addStringOption((option) => option.setName('الوصف').setDescription('وصف الفعالية').setRequired(false))
    .addStringOption((option) => option.setName('التاريخ').setDescription('تاريخ ووقت الفعالية مثل 2026-12-31T18:00:00').setRequired(true))
    .addIntegerOption((option) => option.setName('المدة').setDescription('مدة الفعالية بالدقائق').setRequired(false).setMinValue(15).setMaxValue(600))
    .addIntegerOption((option) => option.setName('المشاركين').setDescription('عدد المشاركين الأقصى').setRequired(false).setMinValue(2).setMaxValue(500))
    .addStringOption((option) => option.setName('الجوائز').setDescription('الجوائز').setRequired(false))
    .addStringOption((option) => option.setName('الشروط').setDescription('شروط المشاركة').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ لا يمكن استخدام هذا الأمر خارج السيرفر.', ephemeral: true });
      return;
    }

    const name = interaction.options.getString('الاسم', true);
    const description = interaction.options.getString('الوصف') || 'لا يوجد وصف';
    const scheduledAt = new Date(interaction.options.getString('التاريخ', true));
    const durationMinutes = interaction.options.getInteger('المدة') || 60;
    const maxParticipants = interaction.options.getInteger('المشاركين') || 50;
    const rewards = interaction.options.getString('الجوائز') || 'غير محدد';
    const rules = interaction.options.getString('الشروط') || 'لا توجد شروط';

    if (Number.isNaN(scheduledAt.getTime())) {
      await interaction.reply({ content: '❌ صيغة التاريخ غير صحيحة.', ephemeral: true });
      return;
    }

    const created = await createGuildEvent({
      guild: interaction.guild,
      organizerId: interaction.user.id,
      name,
      description,
      scheduledAt,
      durationMinutes,
      maxParticipants,
      rewards,
      rules,
    });

    const embed = await buildEventEmbed(created);
    const components = await buildEventButtons(created.id);

    await interaction.reply({ embeds: [embed], components });
    await logEventAction(interaction.guild, '🎉 فعالية جديدة', `المنظم: <@${interaction.user.id}>\nالفعالية: ${name}\nالوقت: ${scheduledAt.toLocaleString('ar-SA')}`);
  },
};
