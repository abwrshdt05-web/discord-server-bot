import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  CommandInteraction,
} from 'discord.js';
import { logModerationAction } from '../../services/moderationService';

export default {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member for a given duration')
    .addUserOption((option) =>
      option.setName('user').setDescription('The member to timeout').setRequired(true)
    )
    .addIntegerOption((option) =>
      option.setName('minutes').setDescription('Timeout duration in minutes').setRequired(true).setMinValue(1).setMaxValue(10080)
    )
    .addStringOption((option) =>
      option.setName('reason').setDescription('Reason for timeout').setRequired(false)
    ),

  async execute(interaction: CommandInteraction) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      await interaction.reply({ content: 'You do not have permission to timeout members.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const minutes = interaction.options.getInteger('minutes', true);
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const targetMember = interaction.guild.members.cache.get(targetUser.id) || await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (!targetMember) {
      await interaction.reply({ content: 'That user is not in the server.', ephemeral: true });
      return;
    }

    await targetMember.timeout(minutes * 60 * 1000, reason);
    await logModerationAction({
      guildId: interaction.guild.id,
      userId: targetUser.id,
      moderatorId: interaction.user.id,
      action: 'timeout',
      reason: `${reason} (${minutes} minutes)`,
    });

    await interaction.reply({ content: `✅ ${targetUser.tag} has been timed out for ${minutes} minutes.` });
  },
};
