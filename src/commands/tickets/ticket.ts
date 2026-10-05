import {
  Client,
  Events,
  Interaction,
  MessageFlags,
  ButtonInteraction,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { prisma } from '../db/client';
import { getGuildConfig, logModerationAction } from '../services/moderationService';
import {
  createTicketChannel,
  createTicketRecord,
  findTicketByChannelId,
  getNextTicketNumber,
  closeTicketRecord,
  reopenTicketRecord,
  claimTicketRecord,
  generateTicketTranscript,
} from '../services/ticketService';
import { logger } from '../utils/logger';

export function registerInteractionCreateEvent(client: Client, commandHandler: any) {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = commandHandler.commands.get(interaction.commandName);

        if (!command) return;

        await command.execute(interaction, client);
        return;
      }

      if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
        return;
      }
    } catch (error) {
      logger.error(error);

      if (interaction.isRepliable()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({
            content: 'An error occurred while executing this action.',
            ephemeral: true,
          });
        } else {
          await interaction.reply({
            content: 'An error occurred while executing this action.',
            ephemeral: true,
          });
        }
      }
    }
  });
}

async function handleButtonInteraction(interaction: ButtonInteraction) {
  const { customId } = interaction;

  if (customId.startsWith('ticket:')) {
    await handleTicketButton(interaction);
    return;
  }
}

async function handleTicketButton(interaction: ButtonInteraction) {
  const [, action, value] = interaction.customId.split(':');

  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: 'This action can only be used in a server.', ephemeral: true });
    return;
  }

  const guildId = interaction.guild.id;
  const userId = interaction.user.id;

  if (action === 'open') {
    const ticketType = value || 'general';
    const config = await getGuildConfig(guildId);
    const number = await getNextTicketNumber(guildId);

    const categoryId = config.ticketCategoryId || undefined;
    const channel = await createTicketChannel({
      guild: interaction.guild,
      creator: interaction.user,
      type: ticketType,
      categoryId,
      number,
    });

    await createTicketRecord({
      guildId,
      channelId: channel.id,
      creatorId: userId,
      ticketType,
      number,
    });

    await interaction.reply({
      content: `✅ Your ticket has been created: ${channel}`,
      ephemeral: true,
    });

    await logModerationAction({
      guildId,
      userId,
      moderatorId: userId,
      action: 'ticket_open',
      reason: `Ticket type: ${ticketType}`,
    });

    return;
  }

  if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
    await interaction.reply({ content: 'This action can only be used in a text channel.', ephemeral: true });
    return;
  }

  const ticket = await findTicketByChannelId(guildId, interaction.channel.id);

  if (!ticket) {
    await interaction.reply({ content: 'This channel is not a valid ticket.', ephemeral: true });
    return;
  }

  if (action === 'close') {
    await closeTicketRecord(ticket.id);
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
      ViewChannel: false,
      SendMessages: false,
    });
    await interaction.reply({ content: '✅ Ticket closed.', ephemeral: true });
    return;
  }

  if (action === 'reopen') {
    await reopenTicketRecord(ticket.id);
    await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
      ViewChannel: true,
      SendMessages: true,
    });
    await interaction.reply({ content: '✅ Ticket reopened.', ephemeral: true });
    return;
  }

  if (action === 'claim') {
    await claimTicketRecord(ticket.id, userId);
    await interaction.reply({ content: `✅ Ticket claimed by <@${userId}>.`, ephemeral: true });
    return;
  }

  if (action === 'transcript') {
    const transcript = await generateTicketTranscript(interaction.channel);
    const transcriptChannel = interaction.guild.channels.cache.get((await getGuildConfig(guildId)).moderationLogChannel || '');

    if (transcriptChannel && 'send' in transcriptChannel) {
      await transcriptChannel.send({
        content: `Ticket transcript for #${ticket.number}\n\n${transcript}`,
      });
      await interaction.reply({ content: '✅ Transcript sent to logs.', ephemeral: true });
    } else {
      await interaction.reply({ content: `Transcript:\n\n${transcript}`, ephemeral: true });
    }
  }
}
