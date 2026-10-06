import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { createRolePanel } from '../../services/interactiveRoleService';

export default {
  data: new SlashCommandBuilder()
    .setName('رتب-تفاعلية')
    .setDescription('عرض لوحة الرتب التفاعلية')
    .addStringOption((option) =>
      option.setName('الفئة').setDescription('اسم الفئة').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('العنوان').setDescription('عنوان اللوحة').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ لا يمكن استخدام هذا الأمر خارج السيرفر.', ephemeral: true });
      return;
    }

    const category = interaction.options.getString('الفئة', true);
    const title = interaction.options.getString('العنوان') || '🎭 الرتب التفاعلية';

    const panel = await createRolePanel(interaction.guild, category, title, 'اختر الرتب التي تريد الحصول عليها:');
    await interaction.reply({ embeds: [panel.embed], components: panel.components, ephemeral: false });
  },
};
