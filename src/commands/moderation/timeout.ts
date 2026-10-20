import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { logModerationAction } from '../../services/moderationService';
import { logger } from '../../utils/logger';

const command = new SlashCommandBuilder()
  .setName('timeout')
  .setDescription('تقييد عضو لمدة محددة')
  .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
  .addUserOption((option) => option.setName('user').setDescription('العضو المراد تقييده').setRequired(true))
  .addIntegerOption((option) =>
    option.setName('minutes').setDescription('المدة بالدقائق (1–40320)').setMinValue(1).setMaxValue(40320).setRequired(true),
  )
  .addStringOption((option) =>
    option.setName('reason').setDescription('سبب التقييد').setMaxLength(512).setRequired(false),
  );

export default {
  data: command,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ هذا الأمر يعمل داخل السيرفر فقط.', ephemeral: true });
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: '❌ تحتاج صلاحية تقييد الأعضاء.', ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('user', true);
    const minutes = interaction.options.getInteger('minutes', true);
    const reason = interaction.options.getString('reason') || 'لم يُحدد سبب';
    const [actor, target, botMember] = await Promise.all([
      interaction.guild.members.fetch(interaction.user.id).catch(() => null),
      interaction.guild.members.fetch(user.id).catch(() => null),
      interaction.guild.members.fetchMe().catch(() => null),
    ]);
    if (!actor || !target || !botMember) {
      await interaction.reply({ content: '❌ العضو غير موجود أو تعذر التحقق من صلاحيات البوت.', ephemeral: true });
      return;
    }
    if (target.id === actor.id || target.id === botMember.id || target.id === interaction.guild.ownerId) {
      await interaction.reply({ content: '❌ لا يمكن تقييد نفسك أو البوت أو مالك السيرفر.', ephemeral: true });
      return;
    }
    if (target.roles.highest.comparePositionTo(actor.roles.highest) >= 0 && actor.id !== interaction.guild.ownerId) {
      await interaction.reply({ content: '❌ لا يمكنك تقييد عضو رتبته مساوية لرتبتك أو أعلى منها.', ephemeral: true });
      return;
    }
    if (!botMember.permissions.has(PermissionFlagsBits.ModerateMembers) ||
        target.roles.highest.comparePositionTo(botMember.roles.highest) >= 0) {
      await interaction.reply({ content: '❌ رتبة البوت أو صلاحياته لا تسمح بتقييد هذا العضو.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      await target.timeout(minutes * 60_000, reason);
      await logModerationAction({
        guild: interaction.guild,
        guildId: interaction.guild.id,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: 'timeout',
        reason: `${reason} (${minutes} دقيقة)`,
      });
      await interaction.editReply(`✅ تم تقييد ${user.tag} لمدة ${minutes} دقيقة.\n**السبب:** ${reason}`);
    } catch (error) {
      logger.error({ err: error, guildId: interaction.guild.id, targetId: target.id }, 'Timeout command failed');
      await interaction.editReply('❌ تعذر تقييد العضو. تحقق من الصلاحيات وترتيب الرتب.');
    }
  },
};
