import cron from 'node-cron';
import fs from 'node:fs';
import { InlineKeyboard, InputFile } from 'grammy';
import { config } from './config.js';
import { makeBackup } from './handlers/admin.js';
import { postToChannel } from './handlers/adminMovies.js';
import { notifyAdmins } from './lib/notify.js';
import { purgeStaleStates } from './lib/state.js';
import * as Users from './services/users.js';
import * as Movies from './services/movies.js';
import * as Reminders from './services/reminders.js';
import { allChannels } from './services/channels.js';
import { getSetting } from './services/settings.js';
import { nf, fmtDate, esc, sleep, movieLine } from './lib/utils.js';

const TZ = 'Asia/Tashkent';

async function targetChannel() {
  if (config.postChannel) return config.postChannel;
  const chs = await allChannels();
  return chs[0]?.chat_id || null;
}

// ==================== 4) Kun kinosi ====================
export async function runDailyMovie(api, { force = false } = {}) {
  if (!force && !(await getSetting('daily_movie', false))) return null;
  const movie = await Movies.pickDaily();
  if (!movie) return null;

  await postToChannel(api, movie).catch((e) => { throw e; });
  await Movies.markDaily(movie.id);

  if (await getSetting('daily_movie_broadcast', false)) {
    const ids = await Users.notifyTargets(movie.genres);
    const text =
      `🎬 <b>Kun kinosi</b>\n\n<b>${esc(movie.title || movie.code)}</b>` +
      `${movie.year ? ` (${movie.year})` : ''}\n` +
      `${movie.genres?.length ? `🎭 ${esc(movie.genres.join(', '))}\n` : ''}` +
      `\n🔢 Kod: <code>${esc(movie.code)}</code>`;
    const kb = new InlineKeyboard().text('🍿 Ko\'rish', `m:get:${movie.code}`);
    for (let i = 0; i < ids.length; i++) {
      await api.sendMessage(ids[i], text, { parse_mode: 'HTML', reply_markup: kb })
        .catch(async (e) => { if (e?.error_code === 403) await Users.markStopped(ids[i]).catch(() => {}); });
      if (i % 20 === 19) await sleep(1000);
    }
  }
  return movie;
}

// ==================== 5) Haftalik TOP posti ====================
export async function postWeeklyTop(api) {
  const top = await Movies.weeklyTop(5);
  if (!top.length) return null;
  const ch = await targetChannel();
  if (!ch) throw new Error('Kanal topilmadi');
  let text = '🏆 <b>HAFTANING TOP-5 KINOSI</b>\n\n';
  top.forEach((m, i) => {
    const medal = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i];
    text += `${medal} <b>${esc(m.title || m.code)}</b>${m.year ? ` (${m.year})` : ''}\n`;
    text += `     🔢 Kod: <code>${esc(m.code)}</code> • 👁 ${nf(m.recent)} marta olingan\n\n`;
  });
  text += '👇 Istalganini botdan oling:';
  return api.sendMessage(ch, text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: new InlineKeyboard().url('🍿 Botni ochish', `https://t.me/${config.username}?start=search`),
  });
}

// ==================== 9) Referal liga posti ====================
export async function postLeague(api) {
  const week = await Users.weeklyReferrers(10);
  const ch = await targetChannel();
  if (!ch) throw new Error('Kanal topilmadi');
  let text = '🥇 <b>HAFTA REFERAL LIGASI</b>\n\nDo\'stlarini eng ko\'p taklif qilganlar:\n\n';
  if (!week.length) text += '<i>Bu hafta hech kim taklif qilmadi — keyingi haftada siz birinchi bo\'lishingiz mumkin!</i>\n';
  week.forEach((r, i) => {
    const medal = ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
    text += `${medal} ${r.username ? '@' + esc(r.username) : esc(r.first_name || 'Foydalanuvchi')} — <b>${nf(r.invited)}</b> ta\n`;
  });
  text += '\n🔗 Botdan <code>/liga</code> yozib o\'z o\'rningizni ko\'ring.';
  return api.sendMessage(ch, text, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
    reply_markup: new InlineKeyboard().url('🍿 Botni ochish', `https://t.me/${config.username}?start=search`),
  });
}

// ==================== 7) Eslatmalar ====================
async function sendDueReminders(api) {
  const due = await Reminders.dueReminders(50);
  for (const r of due) {
    await api.sendMessage(
      r.user_id,
      `⏰ <b>Eslatma!</b>\n\nSiz <b>${esc(r.title || r.code)}</b> kinosini ko'rmoqchi edingiz 🍿`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🍿 Hozir ko\'rish', `m:get:${r.code}`) },
    ).catch(async (e) => { if (e?.error_code === 403) await Users.markStopped(r.user_id).catch(() => {}); });
    await Reminders.markSent(r.id);
  }
  return due.length;
}

export function startCron(bot) {
  // Kunlik zaxira — 03:10
  cron.schedule('10 3 * * *', async () => {
    try {
      const file = await makeBackup();
      if (config.secretChannel) {
        await bot.api.sendDocument(config.secretChannel, new InputFile(file), {
          caption: `💾 Kinobot kunlik zaxirasi — ${fmtDate(new Date())}`,
        });
      }
      fs.unlink(file, () => {});
      console.log('[cron] zaxira yuborildi');
    } catch (e) {
      console.error('[cron] zaxira xatosi:', e.message);
      await notifyAdmins(bot.api, `⚠️ Kunlik zaxira olinmadi: ${e.message}`).catch(() => {});
    }
  }, { timezone: TZ });

  // Kunlik hisobot — 09:00
  cron.schedule('0 9 * * *', async () => {
    try {
      const u = await Users.userStats();
      const m = await Movies.movieStats();
      const nfq = await Movies.notFoundSearches(5);
      let text =
        `📊 <b>Kunlik hisobot</b> — ${fmtDate(new Date())}\n\n` +
        `👥 Yangi foydalanuvchi: <b>${nf(u.today)}</b>\n` +
        `👥 Jami: <b>${nf(u.total)}</b> (faol ${nf(u.active)})\n` +
        `🎬 Kinolar: <b>${nf(m.active)}</b>\n` +
        `👁 Bugun yuborilgan: <b>${nf(m.watched_today)}</b>\n` +
        `🔎 Bugun qidiruv: <b>${nf(m.searches_today)}</b>\n`;
      if (nfq.length) {
        text += '\n❌ <b>Topilmayotgan so\'rovlar:</b>\n';
        nfq.forEach((r) => { text += `• ${esc(r.query)} (${r.c}x)\n`; });
      }
      await notifyAdmins(bot.api, text);
    } catch (e) { console.error('[cron] hisobot xatosi:', e.message); }
  }, { timezone: TZ });

  // Kun kinosi — har soat boshida, sozlangan soatga to'g'ri kelsa ishlaydi
  cron.schedule('0 * * * *', async () => {
    try {
      if (!(await getSetting('daily_movie', false))) return;
      const hour = Number(await getSetting('daily_movie_hour', 19));
      const now = Number(new Date().toLocaleString('en-US', { timeZone: TZ, hour: '2-digit', hour12: false }));
      if (now !== hour) return;
      const m = await runDailyMovie(bot.api);
      if (m) console.log(`[cron] kun kinosi: ${m.code}`);
    } catch (e) {
      console.error('[cron] kun kinosi xatosi:', e.message);
      await notifyAdmins(bot.api, `⚠️ Kun kinosi yuborilmadi: ${e.message}`).catch(() => {});
    }
  }, { timezone: TZ });

  // Haftalik TOP — yakshanba 20:00
  cron.schedule('0 20 * * 0', async () => {
    if (!(await getSetting('weekly_top', false))) return;
    try { await postWeeklyTop(bot.api); console.log('[cron] haftalik TOP joylandi'); }
    catch (e) { console.error('[cron] haftalik TOP:', e.message); }
  }, { timezone: TZ });

  // Referal liga — yakshanba 20:10
  cron.schedule('10 20 * * 0', async () => {
    if (!(await getSetting('ref_league', false))) return;
    try { await postLeague(bot.api); console.log('[cron] liga joylandi'); }
    catch (e) { console.error('[cron] liga:', e.message); }
  }, { timezone: TZ });

  // Eslatmalar — har 5 daqiqada
  cron.schedule('*/5 * * * *', async () => {
    try {
      const n = await sendDueReminders(bot.api);
      if (n) console.log(`[cron] ${n} ta eslatma yuborildi`);
    } catch (e) { console.error('[cron] eslatma:', e.message); }
  }, { timezone: TZ });

  // Yarim qolgan holatlarni tozalash — har soat
  cron.schedule('5 * * * *', async () => {
    const n = await purgeStaleStates().catch(() => 0);
    if (n) console.log(`[cron] ${n} ta eski holat tozalandi`);
  }, { timezone: TZ });

  console.log('[cron] rejalashtirildi: zaxira 03:10, hisobot 09:00, kun kinosi soat bo\'yicha, haftalik TOP/liga yakshanba, eslatmalar 5 daq.');
}
