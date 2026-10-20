import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { logModerationAction } from '../../services/moderationService';
import { logger } from '../../utils/logger';

const command = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('إلغاء حظر مستخدم')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addStringOption((option) =>
    option.setName('userid').setDescription('معرف المستخدم').setRequired(true),
  )
  .addStringOption((option) =>
    option.setName('reason').setDescription('سبب إلغاء الحظر').setMaxLength(512).setRequired(false),
  );

export default {
  data: command,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ هذا الأمر يعمل داخل السيرفر فقط.', ephemeral: true });
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({ content: '❌ تحتاج صلاحية حظر الأعضاء لإلغاء الحظر.', ephemeral: true });
      return;
    }

    const userId = interaction.options.getString('userid', true).trim();
    if (!/^\d{17,20}$/.test(userId)) {
      await interaction.reply({ content: '❌ أدخل معرف Discord صحيحًا.', ephemeral: true });
      return;
    }
    const reason = interaction.options.getString('reason') || 'لم يُحدد سبب';

    await interaction.deferReply({ ephemeral: true });
    try {
      await interaction.guild.members.unban(userId, reason);
      await logModerationAction({
        guild: interaction.guild,
        guildId: interaction.guild.id,
        userId,
        moderatorId: interaction.user.id,
        action: 'unban',
        reason,
      });
      await interaction.editReply(`✅ تم إلغاء حظر المستخدم ${userId}.\n**السبب:** ${reason}`);
    } catch (error) {
      logger.error({ err: error, guildId: interaction.guild.id, targetId: userId }, 'Unban command failed');
      await interaction.editReply('❌ تعذر إلغاء الحظر. تأكد من المعرف وأن المستخدم محظور.');
    }
  },
};
