import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} from 'discord.js';
import { logModerationAction } from '../../services/moderationService';

export default {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption((option) =>
      option.setName('user').setDescription('The member to ban').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for banning').setRequired(false)
    ),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({ content: 'You do not have permission to ban members.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    if (targetUser.id === interaction.user.id) {
      await interaction.reply({ content: 'You cannot ban yourself.', ephemeral: true });
      return;
    }

    try {
      await interaction.guild.members.ban(targetUser, { reason });
      await logModerationAction({
        guildId: interaction.guild.id,
        userId: targetUser.id,
        moderatorId: interaction.user.id,
        action: 'ban',
        reason,
      });
      await interaction.reply({ content: `✅ ${targetUser.tag} was banned. Reason: ${reason}` });
    } catch (error) {
      await interaction.reply({ content: 'Failed to ban that member. Check bot permissions.', ephemeral: true });
    }
  },
};
