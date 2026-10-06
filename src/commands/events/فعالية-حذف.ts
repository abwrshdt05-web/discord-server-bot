import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits } from 'discord.js';
import { prisma } from '../../db/client';
import { logEventAction } from '../../services/eventService';

export default {
  data: new SlashCommandBuilder()
    .setName('فعالية-انهاء')
    .setDescription('إنهاء فعالية محددة')
    .addStringOption((option) => option.setName('الاسم').setDescription('اسم الفعالية').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: '❌ لا يمكن استخدام هذا الأمر خارج السيرفر.', ephemeral: true });
      return;
    }

    const name = interaction.options.getString('الاسم', true);
    const event = await prisma.guildEvent.findFirst({ where: { guildId: interaction.guild.id, name } });
    if (!event) {
      await interaction.reply({ content: '❌ لم يتم العثور على هذه الفعالية.', ephemeral: true });
      return;
    }

    await prisma.guildEvent.update({ where: { id: event.id }, data: { status: 'ended' } });
    await logEventAction(interaction.guild, '⏹️ تم إنهاء فعالية', `الفعالية: ${event.name}\nمنظم: <@${event.organizerId}>`);
    await interaction.reply({ content: `✅ تم إنهاء فعالية: ${event.name}`, ephemeral: true });
  },
};
