import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import {
  applyMissingChannelStructure,
  previewChannelCleanup,
  requestDuplicateChannelDeletion,
} from '../../services/channelCleanupService';
import { logger } from '../../utils/logger';

const command = new SlashCommandBuilder()
  .setName('تنظيف-القنوات')
  .setDescription('معاينة بنية القنوات وإضافة المفقود بأمان')
  .addSubcommand((subcommand) => subcommand.setName('preview').setDescription('معاينة ما ينقص والتكرارات دون تغيير شيء'))
  .addSubcommand((subcommand) => subcommand.setName('apply').setDescription('إنشاء التصنيفات والقنوات الناقصة فقط'))
  .addSubcommand((subcommand) =>
    subcommand
      .setName('delete-duplicate')
      .setDescription('طلب حذف قناة مكررة وفارغة بعد فحصها وتأكيدك')
      .addChannelOption((option) => option.setName('channel').setDescription('القناة المراد فحصها').setRequired(true)),
  );

function canManageChannels(interaction: ChatInputCommandInteraction) {
  return Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator),
  );
}

function buildPreviewEmbed(plan: Awaited<ReturnType<typeof previewChannelCleanup>>) {
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('معاينة تنظيف القنوات')
    .setDescription(
      'هذه معاينة فقط: لم يتم حذف أو إعادة تسمية أو نقل أي قناة. خيار التطبيق ينشئ القنوات الناقصة فقط.',
    )
    .addFields(
      {
        name: `تصنيفات ناقصة (${plan.missingCategories.length})`,
        value: plan.missingCategories.length ? plan.missingCategories.join('، ').slice(0, 1000) : 'لا يوجد',
      },
      {
        name: `قنوات ناقصة (${plan.missingChannels.length})`,
        value: plan.missingChannels.length
          ? plan.missingChannels
              .slice(0, 18)
              .map((item) => `• ${item.category} / ${item.name}`)
              .join('\n')
              .slice(0, 1000) +
            (plan.missingChannels.length > 18 ? `\n… و${plan.missingChannels.length - 18} أخرى` : '')
          : 'لا يوجد',
      },
      {
        name: `مجموعات مكررة (${plan.duplicates.length})`,
        value: plan.duplicates.length
          ? plan.duplicates
              .slice(0, 8)
              .map((group) => `• **${group.name}**: ${group.channels.map((channel) => `<#${channel.id}>`).join('، ')}`)
              .join('\n')
              .slice(0, 1000) +
            (plan.duplicates.length > 8 ? `\n… و${plan.duplicates.length - 8} مجموعات أخرى` : '')
          : 'لا يوجد',
      },
      {
        name: 'حماية السجلات',
        value: `${plan.protectedTicketIds.size} قناة مرتبطة بسجلات تذاكر؛ لن تُحذف من أداة التنظيف.`,
      },
    )
    .setFooter({ text: 'القنوات المكررة التي تحتوي محتوى تحتاج مراجعة يدوية.' });
  return embed;
}

export default {
  data: command,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ هذا الأمر يعمل داخل السيرفر فقط.', ephemeral: true });
      return;
    }
    if (!canManageChannels(interaction)) {
      await interaction.reply({ content: '❌ تحتاج صلاحية إدارة القنوات.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'preview') {
      await interaction.deferReply({ ephemeral: true });
      const plan = await previewChannelCleanup(interaction.guild);
      await interaction.editReply({ embeds: [buildPreviewEmbed(plan)] });
      return;
    }

    if (subcommand === 'apply') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const result = await applyMissingChannelStructure(interaction.guild);
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor('#57F287')
              .setTitle('اكتمل إنشاء القنوات الناقصة')
              .setDescription(
                `**تصنيفات أُنشئت:** ${result.createdCategories.length}\n` +
                  `**قنوات أُنشئت:** ${result.createdChannels.length}\n` +
                  `**تكرارات باقية للمراجعة:** ${result.duplicates.length}\n\n` +
                  'لم يتم حذف أو نقل أو إعادة تسمية أي قناة موجودة.',
              )
              .addFields({
                name: 'قنوات أُنشئت',
                value: result.createdChannels.length
                  ? result.createdChannels.slice(0, 18).map((name) => `• ${name}`).join('\n').slice(0, 1000)
                  : 'لا توجد قنوات ناقصة.',
              }),
          ],
        });
      } catch (error) {
        logger.error({ err: error, guildId: interaction.guild.id }, 'Safe channel setup failed');
        await interaction.editReply('❌ تعذر إكمال إنشاء القنوات. تحقق من صلاحية إدارة القنوات.');
      }
      return;
    }

    const selectedOption = interaction.options.getChannel('channel', true);
    const selectedChannel = await interaction.guild.channels.fetch(selectedOption.id).catch(() => null);
    if (!selectedChannel) {
      await interaction.reply({ content: '❌ القناة غير موجودة أو تعذر جلبها.', ephemeral: true });
      return;
    }
    const result = await requestDuplicateChannelDeletion(
      interaction.guild,
      selectedChannel,
      interaction.user.id,
    );
    if (!result.safe || !('confirmationId' in result)) {
      await interaction.reply({ content: `⛔ لم يُطلب الحذف: ${result.reason}`, ephemeral: true });
      return;
    }

    const button = new ButtonBuilder()
      .setCustomId(result.confirmationId)
      .setLabel('تأكيد حذف القناة الفارغة')
      .setStyle(ButtonStyle.Danger);
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
    await interaction.reply({
      content:
        `⚠️ معاينة الحذف: <#${selectedChannel.id}> قناة مكررة وفارغة ولا تحتوي سجل تذكرة.\n` +
        `${result.reason}\n` +
        'لن يتم الحذف إلا بعد ضغط زر التأكيد خلال دقيقة، وسيُعاد الفحص قبل التنفيذ.',
      components: [row],
      ephemeral: true,
    });
  },
};
