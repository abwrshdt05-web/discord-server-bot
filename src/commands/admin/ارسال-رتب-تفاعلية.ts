import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../../db/client';

export default {
  data: new SlashCommandBuilder()
    .setName('حذف-رتبة-تفاعلية')
    .setDescription('حذف رتبة من اللوحة التفاعلية')
    .addRoleOption((option) => option.setName('الرتبة').setDescription('الرتبة المراد حذفها').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ لا يمكن استخدام هذا الأمر خارج السيرفر.', ephemeral: true });
      return;
    }

    const role = interaction.options.getRole('الرتبة', true);
    await prisma.interactiveRole.deleteMany({ where: { guildId: interaction.guild.id, roleId: role.id } });
    await interaction.reply({ content: `✅ تم حذف الرتبة التفاعلية: ${role.name}`, ephemeral: true });
  },
};
