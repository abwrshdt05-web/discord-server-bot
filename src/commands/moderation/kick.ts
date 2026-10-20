import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { logModerationAction } from '../../services/moderationService';
import { logger } from '../../utils/logger';

const command = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('طرد عضو من السيرفر')
  .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
  .addUserOption((option) =>
    option.setName('user').setDescription('العضو المراد طرده').setRequired(true),
  )
  .addStringOption((option) =>
    option.setName('reason').setDescription('سبب الطرد').setMaxLength(512).setRequired(false),
  );

export default {
  data: command,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ هذا الأمر يعمل داخل السيرفر فقط.', ephemeral: true });
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
      await interaction.reply({ content: '❌ تحتاج صلاحية طرد الأعضاء.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'لم يُحدد سبب';
    const [actor, target, botMember] = await Promise.all([
      interaction.guild.members.fetch(interaction.user.id).catch(() => null),
      interaction.guild.members.fetch(targetUser.id).catch(() => null),
      interaction.guild.members.fetchMe().catch(() => null),
    ]);
    if (!actor || !target || !botMember) {
      await interaction.reply({ content: '❌ تعذر العثور على العضو أو التحقق من عضوية البوت.', ephemeral: true });
      return;
    }
    if (target.id === interaction.user.id || target.id === botMember.id) {
      await interaction.reply({ content: '❌ لا يمكن طرد نفسك أو البوت.', ephemeral: true });
      return;
    }
    if (target.id === interaction.guild.ownerId) {
      await interaction.reply({ content: '❌ لا يمكن طرد مالك السيرفر.', ephemeral: true });
      return;
    }
    if (target.roles.highest.comparePositionTo(actor.roles.highest) >= 0 && actor.id !== interaction.guild.ownerId) {
      await interaction.reply({ content: '❌ لا يمكنك طرد عضو رتبته مساوية لرتبتك أو أعلى منها.', ephemeral: true });
      return;
    }
    if (!botMember.permissions.has(PermissionFlagsBits.KickMembers) ||
        target.roles.highest.comparePositionTo(botMember.roles.highest) >= 0) {
      await interaction.reply({ content: '❌ رتبة البوت أو صلاحياته لا تسمح بطرد هذا العضو.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      await target.kick(reason);
      await logModerationAction({
        guildId: interaction.guild.id,
        userId: target.id,
        moderatorId: interaction.user.id,
        action: 'kick',
        reason,
      });
      await interaction.editReply(`✅ تم طرد ${target.user.tag}.\n**السبب:** ${reason}`);
    } catch (error) {
      logger.error({ err: error, guildId: interaction.guild.id, targetId: target.id }, 'Kick command failed');
      await interaction.editReply('❌ تعذر طرد العضو. تحقق من صلاحيات البوت وترتيب الرتب.');
    }
  },
};
