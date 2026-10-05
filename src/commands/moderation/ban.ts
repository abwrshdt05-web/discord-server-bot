import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} from 'discord.js';
import { logModerationAction } from '../../services/moderationService';

export default {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption((option) =>
      option.setName('user').setDescription('The member to kick').setRequired(true)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for kicking').setRequired(false)
    ),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
      await interaction.reply({ content: 'You do not have permission to kick members.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const targetMember = interaction.guild.members.cache.get(targetUser.id) || await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      await interaction.reply({ content: 'That user is not in the server.', ephemeral: true });
      return;
    }

    if (targetMember.id === interaction.user.id) {
      await interaction.reply({ content: 'You cannot kick yourself.', ephemeral: true });
      return;
    }

    try {
      await targetMember.kick(reason);
      await logModerationAction({
        guildId: interaction.guild.id,
        userId: targetMember.id,
        moderatorId: interaction.user.id,
        action: 'kick',
        reason,
      });
      await interaction.reply({ content: `✅ ${targetUser.tag} was kicked. Reason: ${reason}` });
    } catch (error) {
      await interaction.reply({ content: 'Failed to kick that member. Check bot permissions.', ephemeral: true });
    }
  },
};
