import 'dotenv/config';

export const env = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
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
