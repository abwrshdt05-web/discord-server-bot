import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} from 'discord.js';
import { logModerationAction } from '../../services/moderationService';

export default {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server')
    .addStringOption((option) =>
      option.setName('userid').setDescription('User ID to unban').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for unban').setRequired(false)
    ),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
      await interaction.reply({ content: 'You do not have permission to unban members.', ephemeral: true });
      return;
    }

    const userId = interaction.options.getString('userid', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    try {
      await interaction.guild.members.unban(userId, reason);
      await logModerationAction({
        guildId: interaction.guild.id,
        userId,
        moderatorId: interaction.user.id,
        action: 'unban',
        reason,
      });
      await interaction.reply({ content: `✅ User ID ${userId} was unbanned. Reason: ${reason}` });
    } catch (error) {
      await interaction.reply({ content: 'Failed to unban that user. Check the ID and permissions.', ephemeral: true });
    }
  },
};
