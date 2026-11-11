import http from 'node:http';
import { webhookCallback } from 'grammy';
import { config, webhookUrl } from './config.js';
import { bot, handleBotError } from './bot.js';
import { pool } from './db.js';
import { startCron } from './cron.js';
import { notifyAdmins } from './lib/notify.js';

const ALLOWED_UPDATES = ['message', 'callback_query', 'inline_query', 'chosen_inline_result', 'channel_post', 'my_chat_member', 'chat_member'];

const COMMANDS = [
  { command: 'start', description: '🏠 Botni ishga tushirish' },
  { command: 'menu', description: '📋 Bosh menyu' },
  { command: 'tavsiya', description: '🎯 Kayfiyatim bo\'yicha tavsiya' },
  { command: 'men', description: '📊 Mening kino hisobotim' },
  { command: 'sorovlar', description: '🗳 So\'rovlar reytingi' },
  { command: 'seriallar', description: '📺 Seriallar' },
  { command: 'davom', description: '▶️ To\'xtagan joydan davom etish' },
  { command: 'trend', description: '🔥 Bugungi trend' },
  { command: 'liga', description: '🏆 Referal liga' },
  { command: 'eslatmalar', description: '⏰ Eslatmalarim' },
  { command: 'bildirishnoma', description: '🔔 Bildirishnoma sozlamalari' },
  { command: 'help', description: 'ℹ️ Yordam' },
  { command: 'ref', description: '👥 Referal havolam' },
  { command: 'id', description: '🆔 ID raqamim' },
];

async function main() {
  await pool.query('SELECT 1');
  console.log('[db] ulanish OK');

  await bot.init();
  console.log(`[bot] @${bot.botInfo.username} (${bot.botInfo.id})`);

  await bot.api.setMyCommands(COMMANDS).catch((e) => console.warn('[bot] buyruqlar:', e.message));

  if (config.mode === 'webhook') {
    const handle = webhookCallback(bot, 'http', { secretToken: config.webhookSecret, timeoutMilliseconds: 55_000 });
    const server = http.createServer(async (req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, bot: bot.botInfo.username, mode: 'webhook' }));
        return;
      }
      if (req.method === 'POST' && req.url === config.webhookPath) {
        try {
          await handle(req, res);
        } catch (e) {
          // Xatoni O'ZIMIZ ushlaymiz va Telegram ga 200 qaytaramiz, aks holda
          // Telegram xato update ni qayta-qayta yuborib halqaga tushadi.
          await handleBotError(e).catch(() => {});
          if (!res.writableEnded) { res.writeHead(200); res.end('OK'); }
        }
        return;
      }
      res.writeHead(404); res.end();
    });
    server.listen(config.port, '127.0.0.1', async () => {
      console.log(`[web] 127.0.0.1:${config.port} tinglanmoqda, yo'l: ${config.webhookPath}`);
      const info = await bot.api.getWebhookInfo();
      // allowed_updates ham solishtiriladi — yangi hodisa turi qo'shilsa o'zi qayta ro'yxatdan o'tadi
      const cur = [...(info.allowed_updates ?? [])].sort().join(',');
      const want = [...ALLOWED_UPDATES].sort().join(',');
      if (info.url !== webhookUrl || cur !== want) {
        await bot.api.setWebhook(webhookUrl, {
          secret_token: config.webhookSecret,
          allowed_updates: ALLOWED_UPDATES,
        });
        console.log(`[bot] webhook o'rnatildi: ${webhookUrl} (hodisalar: ${ALLOWED_UPDATES.length})`);
      } else {
        console.log('[bot] webhook allaqachon to\'g\'ri');
      }
    });
    shutdown(server);
  } else {
    await bot.api.deleteWebhook({ drop_pending_updates: true }).catch(() => {});
    console.log('[bot] polling rejimi (webhook o\'chirildi)');
    // /health uchun kichik server (pm2 monitoring qulayligi)
    const server = http.createServer((req, res) => {
      res.writeHead(req.url === '/health' ? 200 : 404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, bot: bot.botInfo.username, mode: 'polling' }));
    });
    server.listen(config.port, '127.0.0.1');
    bot.start({
      allowed_updates: ALLOWED_UPDATES,
      onStart: (i) => console.log(`[bot] polling boshlandi: @${i.username}`),
    });
    shutdown(server);
  }

  startCron(bot);
}

function shutdown(server) {
  let stopping = false;
  const stop = async (sig) => {
    if (stopping) return;
    stopping = true;
    console.log(`[bot] ${sig} — to'xtatilmoqda...`);
    try { await bot.stop(); } catch { /* ignore */ }
    server?.close();
    await pool.end().catch(() => {});
    process.exit(0);
  };
  process.once('SIGINT', () => stop('SIGINT'));
  process.once('SIGTERM', () => stop('SIGTERM'));
}

process.on('unhandledRejection', (r) => console.error('[unhandledRejection]', r));
process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));

main().catch(async (e) => {
  console.error('[fatal]', e);
  try { await notifyAdmins(bot.api, `🔴 Bot ishga tushmadi: ${e.message}`); } catch { /* ignore */ }
  process.exit(1);
});
