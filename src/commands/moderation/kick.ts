import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  CommandInteraction,
  Client,
} from 'discord.js';
import { prisma } from '../../db/client';
import { getGuildConfig } from '../../services/moderationService';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket management commands')
    .addSubcommand((sub) =>
      sub.setName('setup').setDescription('Create a ticket panel in the current channel')
    )
    .addSubcommand((sub) =>
      sub.setName('close').setDescription('Close the current ticket')
    )
    .addSubcommand((sub) =>
      sub.setName('reopen').setDescription('Reopen the current ticket')
    )
    .addSubcommand((sub) =>
      sub.setName('claim').setDescription('Claim the current ticket')
    )
    .addSubcommand((sub) =>
      sub.setName('add').addUserOption((option) =>
        option.setName('user').setDescription('User to add to the ticket').setRequired(true)
      ).setDescription('Add a user to the current ticket')
    )
    .addSubcommand((sub) =>
      sub.setName('remove').addUserOption((option) =>
        option.setName('user').setDescription('User to remove from the ticket').setRequired(true)
      ).setDescription('Remove a user from the current ticket')
    )
    .addSubcommand((sub) =>
      sub.setName('transcript').setDescription('Generate a transcript for the current ticket')
    )
    .addSubcommand((sub) =>
      sub.setName('create').addStringOption((option) =>
        option.setName('type').setDescription('Ticket type').setRequired(false).addChoices(
          { name: 'General', value: 'general' },
          { name: 'Support', value: 'support' },
          { name: 'Report', value: 'report' },
          { name: 'Appeal', value: 'appeal' }
        )
      ).setDescription('Create a new ticket manually')
    ),

  async execute(interaction: CommandInteraction, client: Client) {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'setup') {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: 'You do not have permission to set up tickets.', ephemeral: true });
        return;
      }

      const config = await getGuildConfig(interaction.guild.id);
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎫 Ticket Support')
        .setDescription('Choose the type of ticket you need help with.')
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket:open:general')
          .setLabel('General')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ticket:open:support')
          .setLabel('Support')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('ticket:open:report')
          .setLabel('Report')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('ticket:open:appeal')
          .setLabel('Appeal')
          .setStyle(ButtonStyle.Success)
      );

      const category = await interaction.guild.channels.create({
        name: 'Tickets',
        type: 4,
      });

      config.ticketCategoryId = category.id;
      await prisma.guildConfig.update({
        where: { guildId: interaction.guild.id },
        data: { ticketCategoryId: category.id },
      });

      await interaction.channel?.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: '✅ Ticket panel created.', ephemeral: true });
      return;
    }

    if (subcommand === 'create') {
      const type = interaction.options.getString('type') || 'general';
      const channel = await interaction.guild.channels.create({
        name: `ticket-${Date.now().toString().slice(-4)}`,
        type: 0,
        parent: (await getGuildConfig(interaction.guild.id)).ticketCategoryId || undefined,
        permissionOverwrites: [
          {
            id: interaction.guild.roles.everyone.id,
            deny: [1n << 10n],
          },
          {
            id: interaction.user.id,
            allow: [
              'ViewChannel',
              'SendMessages',
              'ReadMessageHistory',
            ],
          },
        ],
      });

      await interaction.reply({ content: `✅ Ticket created: ${channel}`, ephemeral: true });
      return;
    }

    if (!interaction.channel || !('isTextBased' in interaction.channel)) {
      await interaction.reply({ content: 'This command must be used in a text channel.', ephemeral: true });
      return;
    }

    if (subcommand === 'close') {
      await interaction.reply({ content: 'Ticket close action is processed by the ticket panel button.', ephemeral: true });
      return;
    }

    if (subcommand === 'reopen') {
      await interaction.reply({ content: 'Ticket reopen action is processed by the ticket panel button.', ephemeral: true });
      return;
    }

    if (subcommand === 'claim') {
      await interaction.reply({ content: 'Ticket claim is handled through the ticket controls.', ephemeral: true });
      return;
    }

    if (subcommand === 'add') {
      const user = interaction.options.getUser('user', true);
      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
      });
      await interaction.reply({ content: `✅ Added ${user.tag} to this ticket.`, ephemeral: true });
      return;
    }

    if (subcommand === 'remove') {
      const user = interaction.options.getUser('user', true);
      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: false,
        SendMessages: false,
        ReadMessageHistory: false,
      });
      await interaction.reply({ content: `✅ Removed ${user.tag} from this ticket.`, ephemeral: true });
      return;
    }

    if (subcommand === 'transcript') {
      const messages = await interaction.channel.messages.fetch({ limit: 100 });
      const transcript = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp).map((m) => `${new Date(m.createdTimestamp).toISOString()} | ${m.author.tag} | ${m.content || '[embed/attachment]'}`).join('\n');
      await interaction.reply({ content: `Transcript:\n\n${transcript.slice(0, 1500) || 'No messages found.'}`, ephemeral: true });
      return;
    }
  },
};
