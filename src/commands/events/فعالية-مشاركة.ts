import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { prisma } from '../../db/client';
import { buildEventEmbed } from '../../services/eventService';

export default {
  data: new SlashCommandBuilder()
    .setName('فعالية-معلومات')
    .setDescription('عرض معلومات فعالية معينة')
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

    const embed = await buildEventEmbed(event);
    await interaction.reply({ embeds: [embed] });
  },
};
