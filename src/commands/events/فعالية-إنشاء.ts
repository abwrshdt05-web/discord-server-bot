import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits } from 'discord.js';
import { createRolePanel } from '../../services/interactiveRoleService';

export default {
  data: new SlashCommandBuilder()
    .setName('ارسال-رتب-تفاعلية')
    .setDescription('إرسال لوحة الرتب التفاعلية إلى قناة محددة')
    .addChannelOption((option) => option.setName('القناة').setDescription('القناة التي سيتم إرسال اللوحة إليها').setRequired(true))
    .addStringOption((option) => option.setName('الفئة').setDescription('اسم الفئة').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ لا يمكن استخدام هذا الأمر خارج السيرفر.', ephemeral: true });
      return;
    }

    const channel = interaction.options.getChannel('القناة', true);
    const category = interaction.options.getString('الفئة', true);
    if (!channel || !channel.isTextBased()) {
      await interaction.reply({ content: '❌ يجب اختيار قناة نصية.', ephemeral: true });
      return;
    }

    const panel = await createRolePanel(interaction.guild, category, '🎭 الرتب التفاعلية', 'اختر الرتب التي تريد الحصول عليها:');
    await channel.send({ embeds: [panel.embed], components: panel.components });
    await interaction.reply({ content: `✅ تم إرسال لوحة الرتب إلى ${channel.toString()}`, ephemeral: true });
  },
};
