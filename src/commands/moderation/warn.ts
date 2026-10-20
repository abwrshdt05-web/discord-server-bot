import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { logModerationAction } from '../../services/moderationService';
import { logger } from '../../utils/logger';

const command = new SlashCommandBuilder()
  .setName('warn')
  .setDescription('تسجيل إنذار لعضو')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((option) => option.setName('user').setDescription('العضو المراد إنذاره').setRequired(true))
  .addStringOption((option) =>
    option.setName('reason').setDescription('سبب الإنذار').setMaxLength(512).setRequired(true),
  );

export default {
  data: command,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ هذا الأمر يعمل داخل السيرفر فقط.', ephemeral: true });
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: '❌ تحتاج صلاحية تقييد الأعضاء لتسجيل إنذار.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    const [actor, target] = await Promise.all([
      interaction.guild.members.fetch(interaction.user.id).catch(() => null),
      interaction.guild.members.fetch(user.id).catch(() => null),
    ]);
    if (!actor || !target) {
      await interaction.reply({ content: '❌ العضو غير موجود في السيرفر.', ephemeral: true });
      return;
    }
    if (target.id === interaction.guild.ownerId || target.id === actor.id) {
      await interaction.reply({ content: '❌ لا يمكن إنذار مالك السيرفر أو نفسك.', ephemeral: true });
      return;
    }
    if (target.roles.highest.comparePositionTo(actor.roles.highest) >= 0 && actor.id !== interaction.guild.ownerId) {
      await interaction.reply({ content: '❌ لا يمكنك إنذار عضو رتبته مساوية لرتبتك أو أعلى منها.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      const record = await logModerationAction({
        guild: interaction.guild,
        guildId: interaction.guild.id,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: 'warn',
        reason,
      });
      await interaction.editReply(`⚠️ سُجّل إنذار لـ ${user.tag}.\n**السبب:** ${reason}\n**رقم السجل:** ${record.id}`);
    } catch (error) {
      logger.error({ err: error, guildId: interaction.guild.id, targetId: target.id }, 'Warn command failed');
      await interaction.editReply('❌ تعذر حفظ الإنذار. لم يُسجل الإجراء.');
    }
  },
};
