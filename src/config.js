import 'dotenv/config';

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

export const config = {
  token: process.env.BOT_TOKEN,
  username: process.env.BOT_USERNAME || '',
  adminIds: (process.env.ADMIN_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number),
  secretChannel: process.env.SECRET_CHANNEL || '',
  sourceChannel: process.env.SOURCE_CHANNEL || '',
  postChannel: process.env.POST_CHANNEL || '',
  welcomeImage: process.env.WELCOME_IMAGE || '',
  mode: (process.env.BOT_MODE || 'polling').toLowerCase(),
  port: num(process.env.PORT, 3180),
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/+$/, ''),
  webhookPath: process.env.WEBHOOK_PATH || '/tg/hook',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  databaseUrl: process.env.DATABASE_URL,
};

if (!config.token) throw new Error('BOT_TOKEN .env da ko\'rsatilmagan');
if (!config.databaseUrl) throw new Error('DATABASE_URL .env da ko\'rsatilmagan');

export const webhookUrl = config.publicUrl + config.webhookPath;
