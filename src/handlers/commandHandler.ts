import fs from 'node:fs';
import path from 'node:path';
import { Collection, Client, SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export type CommandModule = {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction, client: Client) => Promise<void>;
};

export class CommandHandler {
  public commands = new Collection<string, CommandModule>();

  async load(): Promise<void> {
    const rootDir = path.join(__dirname, '..', 'commands');
    const expectedExtension = path.extname(__filename);
    this.commands.clear();

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
          continue;
        }

        if (!entry.isFile() || path.extname(entry.name) !== expectedExtension) continue;
        try {
          const mod = require(fullPath);
          const command = mod.default || mod;
          if (!command?.data || typeof command.execute !== 'function') continue;

          const name = command.data.name as string;
          if (this.commands.has(name)) {
            throw new Error(`Duplicate slash command name "${name}" at ${fullPath}`);
          }
          this.commands.set(name, command as CommandModule);
        } catch (error) {
          logger.error({ err: error, commandPath: fullPath }, 'Failed to load slash command');
          throw error;
        }
      }
    };

    walk(rootDir);
  }

  async registerGlobalCommands() {
    const commands = this.commands.map((command) => command.data.toJSON());

    const { REST } = await import('@discordjs/rest');
    const { Routes } = await import('discord.js');

    const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

    await rest.put(Routes.applicationCommands(env.DISCORD_CLIENT_ID), {
      body: commands,
    });
  }
}
