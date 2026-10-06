import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits } from 'discord.js';
import { ensureInteractiveRole } from '../../services/interactiveRoleService';

export default {
  data: new SlashCommandBuilder()
    .setName('اضافة-رتبة-تفاعلية')
    .setDescription('إضافة رتبة جديدة إلى اللوحة التفاعلية')
    .addStringOption((option) => option.setName('الفئة').setDescription('فئة الرتبة').setRequired(true))
    .addStringOption((option) => option.setName('اسم-الرتبة').setDescription('اسم الرتبة').setRequired(true))
    .addStringOption((option) => option.setName('الايموجي').setDescription('إيموجي الرتبة').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ لا يمكن استخدام هذا الأمر خارج السيرفر.', ephemeral: true });
      return;
    }

    const category = interaction.options.getString('الفئة', true);
    const roleName = interaction.options.getString('اسم-الرتبة', true);
    const emoji = interaction.options.getString('الايموجي') || '🎉';

    const data = await ensureInteractiveRole(interaction.guild, roleName, category, emoji);
    await interaction.reply({ content: `✅ تم إضافة الرتبة التفاعلية: ${roleName} في الفئة: ${category}`, ephemeral: true });
  },
};
