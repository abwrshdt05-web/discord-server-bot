import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { prisma } from '../../db/client';

export default {
  data: new SlashCommandBuilder()
    .setName('فعالية-المشاركين')
    .setDescription('عرض قائمة المشاركين في فعالية')
    .addStringOption((option) => option.setName('الاسم').setDescription('اسم الفعالية').setRequired(true)),

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

    const participants = await prisma.guildEventParticipant.findMany({
      where: { eventId: event.id },
      orderBy: { joinedAt: 'asc' },
    });

    const list = participants.length ? participants.map((p) => `<@${p.userId}>`).join('\n') : 'لا يوجد مشاركون بعد.';
    await interaction.reply({ content: `👥 المشاركون في ${event.name}\n${list}`, ephemeral: true });
  },
};
