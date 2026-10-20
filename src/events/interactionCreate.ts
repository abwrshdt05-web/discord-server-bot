import { Client, Events, Interaction } from 'discord.js';
import { CommandHandler } from '../handlers/commandHandler';
import { confirmDuplicateChannelDeletion } from '../services/channelCleanupService';
import { handleEventButton } from '../services/eventService';
import { toggleInteractiveRole } from '../services/interactiveRoleService';
import {
  handleTicketButtonInteraction,
} from './ticketInteractions';
import { logger } from '../utils/logger';

const registeredClients = new WeakSet<Client>();

export function registerInteractionCreateEvent(client: Client, commandHandler: CommandHandler) {
  if (registeredClients.has(client)) return;
  registeredClients.add(client);

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = commandHandler.commands.get(interaction.commandName);
        if (!command) {
          await interaction.reply({ content: '❌ هذا الأمر غير مسجل حاليًا.', ephemeral: true });
          return;
        }
        await command.execute(interaction, client);
        return;
      }

      if (!interaction.isButton()) return;
      if (interaction.customId.startsWith('ticket:')) {
        await handleTicketButtonInteraction(interaction);
        return;
      }
      if (interaction.customId.startsWith('role_toggle:')) {
        await toggleInteractiveRole(interaction);
        return;
      }
      if (interaction.customId.startsWith('event_')) {
        await handleEventButton(interaction);
        return;
      }
      if (interaction.customId.startsWith('channel-delete-confirm:')) {
        const [, ownerId, channelId] = interaction.customId.split(':');
        if (ownerId !== interaction.user.id || !interaction.guild) {
          await interaction.reply({ content: '❌ هذا التأكيد ليس لك أو انتهت صلاحيته.', ephemeral: true });
          return;
        }
        const result = await confirmDuplicateChannelDeletion(
          interaction.guild,
          channelId,
          interaction.user.id,
        );
        await interaction.update({
          content: result.deleted ? `✅ ${result.reason}` : `⛔ ${result.reason}`,
          components: [],
        });
      }
    } catch (error) {
      logger.error({ err: error }, 'Interaction processing failed');
      if (interaction.isRepliable()) {
        const message = '❌ حدث خطأ أثناء تنفيذ الأمر. راجع صلاحيات البوت أو سجلات التشغيل.';
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: message, ephemeral: true }).catch(() => undefined);
        } else {
          await interaction.reply({ content: message, ephemeral: true }).catch(() => undefined);
        }
      }
    }
  });
}
