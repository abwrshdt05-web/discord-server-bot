import {
  ChannelType,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { logModerationAction } from '../../services/moderationService';
import { logger } from '../../utils/logger';

const command = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('حذف عدد من الرسائل الحديثة من القناة الحالية')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .addIntegerOption((option) =>
    option.setName('amount').setDescription('عدد الرسائل (1–100)').setMinValue(1).setMaxValue(100).setRequired(true),
  )
  .addStringOption((option) =>
    option.setName('reason').setDescription('سبب الحذف').setMaxLength(512).setRequired(false),
  );

export default {
  data: command,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ هذا الأمر يعمل داخل السيرفر فقط.', ephemeral: true });
      return;
    }
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: '❌ تحتاج صلاحية إدارة الرسائل.', ephemeral: true });
      return;
    }
    if (
      !interaction.channel ||
      (interaction.channel.type !== ChannelType.GuildText &&
        interaction.channel.type !== ChannelType.GuildAnnouncement)
    ) {
      await interaction.reply({ content: '❌ استخدم الأمر داخل قناة نصية.', ephemeral: true });
      return;
    }

    const amount = interaction.options.getInteger('amount', true);
    const reason = interaction.options.getString('reason') || 'لم يُحدد سبب';
    const channel = interaction.channel as TextChannel;
    const botMember = await interaction.guild.members.fetchMe().catch(() => null);
    if (!botMember?.permissionsIn(channel).has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: '❌ البوت لا يملك صلاحية إدارة الرسائل في هذه القناة.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });
    try {
      const deleted = await channel.bulkDelete(amount, true);
      await logModerationAction({
        guild: interaction.guild,
        guildId: interaction.guild.id,
        userId: interaction.user.id,
        moderatorId: interaction.user.id,
        action: 'clear',
        reason: `${reason} (${deleted.size} رسالة)`,
      });
      await interaction.editReply(
        deleted.size
          ? `✅ حُذفت ${deleted.size} رسالة حديثة من <#${channel.id}>. الرسائل الأقدم من 14 يومًا لم تُحذف.`
          : 'ℹ️ لم توجد رسائل حديثة قابلة للحذف.',
      );
    } catch (error) {
      logger.error({ err: error, guildId: interaction.guild.id, channelId: channel.id }, 'Clear command failed');
      await interaction.editReply('❌ تعذر حذف الرسائل. تحقق من صلاحيات البوت.');
    }
  },
};
