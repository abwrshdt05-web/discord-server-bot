import fs from 'node:fs';
import path from 'node:path';
import { Collection, Client, SlashCommandBuilder } from 'discord.js';

export type CommandModule = {
  data: SlashCommandBuilder;
  execute: (interaction: any, client: Client) => Promise<void>;
};

export class CommandHandler {
  public commands = new Collection<string, CommandModule>();

  async load(): Promise<void> {
    const rootDir = path.join(process.cwd(), 'src', 'commands');

    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          walk(fullPath);
          continue;
        }

        if (!entry.name.endsWith('.ts')) continue;

        const mod = require(fullPath);
        const command = mod.default || mod;

        if (!command?.data || !command?.execute) continue;

        this.commands.set(command.data.name, command);
      }
    };

    walk(rootDir);
  }

  async registerGlobalCommands() {
    const commands = this.commands.map((command) => command.data.toJSON());

    const { REST } = await import('@discordjs/rest');
    const { Routes } = await import('discord.js');

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), {
      body: commands,
    });
  }
}
