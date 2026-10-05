import 'dotenv/config';

export const env = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  OWNER_ID: process.env.OWNER_ID || '',
};

if (!env.DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN is missing. Set it in .env');
}

if (!env.DISCORD_CLIENT_ID) {
  throw new Error('DISCORD_CLIENT_ID is missing. Set it in .env');
}

if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL is missing. Set it in .env');
}
