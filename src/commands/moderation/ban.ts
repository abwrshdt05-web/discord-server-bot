import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { logModerationAction } from '../../services/moderationService';
import { logger } from '../../utils/logger';

const command = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('حظر عضو من السيرفر')
  .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
  .addUserOption((option) => option.setName('user').setDescription('العضو المراد حظره').setRequired(true))
  .addStringOption((option) =>
    option.setName('reason').setDescription('سبب الحظر').setMaxLength(512).setRequired(false),
  );

export default {
  data: command,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ هذا الأمر يعمل داخل السيرفر فقط.', ephemeral: true });
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({ content: '❌ تحتاج صلاحية حظر الأعضاء.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'لم يُحدد سبب';
    if (targetUser.id === interaction.user.id || targetUser.id === interaction.client.user?.id) {
      await interaction.reply({ content: '❌ لا يمكن حظر نفسك أو البوت.', ephemeral: true });
      return;
    }
    if (targetUser.id === interaction.guild.ownerId) {
      await interaction.reply({ content: '❌ لا يمكن حظر مالك السيرفر.', ephemeral: true });
      return;
    }

    const [actor, targetMember, botMember] = await Promise.all([
      interaction.guild.members.fetch(interaction.user.id).catch(() => null),
      interaction.guild.members.fetch(targetUser.id).catch(() => null),
      interaction.guild.members.fetchMe().catch(() => null),
    ]);
    if (!actor || !botMember) {
      await interaction.reply({ content: '❌ تعذر التحقق من صلاحيات العضو أو البوت.', ephemeral: true });
      return;
    }
    if (targetMember && targetMember.roles.highest.comparePositionTo(actor.roles.highest) >= 0 &&
        actor.id !== interaction.guild.ownerId) {
      await interaction.reply({ content: '❌ لا يمكنك حظر عضو رتبته مساوية لرتبتك أو أعلى منها.', ephemeral: true });
      return;
    }
    if (!botMember.permissions.has(PermissionFlagsBits.BanMembers) ||
        (targetMember && targetMember.roles.highest.comparePositionTo(botMember.roles.highest) >= 0)) {
      await interaction.reply({ content: '❌ رتبة البوت أو صلاحياته لا تسمح بحظر هذا العضو.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      await interaction.guild.members.ban(targetUser, { reason });
      await logModerationAction({
        guild: interaction.guild,
        guildId: interaction.guild.id,
        userId: targetUser.id,
        moderatorId: interaction.user.id,
        action: 'ban',
        reason,
      });
      await interaction.editReply(`✅ تم حظر ${targetUser.tag}.\n**السبب:** ${reason}`);
    } catch (error) {
      logger.error({ err: error, guildId: interaction.guild.id, targetId: targetUser.id }, 'Ban command failed');
      await interaction.editReply('❌ تعذر حظر العضو. تحقق من الصلاحيات وترتيب الرتب.');
    }
  },
};
