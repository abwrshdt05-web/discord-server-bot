import { SlashCommandBuilder, ChatInputCommandInteraction as CommandInteraction, PermissionFlagsBits, EmbedBuilder, ChannelType } from 'discord.js';
import { setupServerDefaults } from '../../services/setupService';

export default {
  data: new SlashCommandBuilder()
    .setName('اعداد-السيرفر')
    .setDescription('إضافة القنوات العربية الأساسية الناقصة دون حذف أو نقل الموجود')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ لا يمكن استخدام هذا الأمر خارج السيرفر.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      await setupServerDefaults(interaction.guild);
      const embed = new EmbedBuilder()
        .setColor('#00C853')
        .setTitle('✅ تم إعداد السيرفر بنجاح')
        .setDescription('أُضيفت القنوات والفئات الناقصة فقط. لم تُحذف أو تُنقل أو يُعاد تسمية أي قناة موجودة.')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      await interaction.editReply({ content: '❌ فشل في إعداد السيرفر. تحقق من صلاحيات البوت.' });
    }
  },
};
