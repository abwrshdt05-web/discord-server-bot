import { Client, Events, Interaction } from 'discord.js';
import { toggleInteractiveRole } from '../services/interactiveRoleService';
import { handleEventButton } from '../services/eventService';

export function registerInteractionCreateEvent(client: Client) {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isButton() && interaction.customId.startsWith('role_toggle:')) {
        await toggleInteractiveRole(interaction);
        return;
      }

      if (interaction.isButton() && interaction.customId.startsWith('event_')) {
        await handleEventButton(interaction);
        return;
      }
    } catch (error) {
      console.error('Interaction failed:', error);
    }
  });
}
