/**
 * Webhookni boshqarish.
 *   node scripts/set-webhook.js info     — hozirgi holat
 *   node scripts/set-webhook.js set      — .env dagi URL ga o'rnatish
 *   node scripts/set-webhook.js delete   — o'chirish (polling uchun)
 */
import { Bot } from 'grammy';
import { config, webhookUrl } from '../src/config.js';

const bot = new Bot(config.token);
const cmd = (process.argv[2] || 'info').toLowerCase();
const ALLOWED = ['message', 'callback_query', 'inline_query', 'chosen_inline_result', 'channel_post', 'my_chat_member', 'chat_member'];

const me = await bot.api.getMe();
console.log(`Bot: @${me.username} (${me.id})`);

if (cmd === 'set') {
  await bot.api.deleteWebhook({ drop_pending_updates: true });
  await bot.api.setWebhook(webhookUrl, {
    secret_token: config.webhookSecret,
    drop_pending_updates: true,
    allowed_updates: ALLOWED,
    max_connections: 40,
  });
  console.log(`✅ Webhook o'rnatildi: ${webhookUrl}`);
} else if (cmd === 'delete') {
  await bot.api.deleteWebhook({ drop_pending_updates: true });
  console.log('✅ Webhook o\'chirildi (polling rejimi uchun tayyor)');
}

const info = await bot.api.getWebhookInfo();
console.log('\nHolati:');
console.log(`  url: ${info.url || '(yo\'q — polling)'}`);
console.log(`  kutayotgan update: ${info.pending_update_count}`);
if (info.last_error_message) {
  console.log(`  oxirgi xato: ${info.last_error_message} (${new Date(info.last_error_date * 1000).toISOString()})`);
}
console.log(`  maxfiy token: ${config.webhookSecret ? 'bor' : 'YO\'Q'}`);
