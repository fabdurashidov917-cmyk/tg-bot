import { Composer, InlineKeyboard, InputFile } from 'grammy';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { adminMain, backAdmin, cancelKb, mainMenu } from '../lib/keyboards.js';
import { esc, nf, fmtDate } from '../lib/utils.js';
import * as Movies from '../services/movies.js';
import * as Users from '../services/users.js';
import * as Requests from '../services/requests.js';
import { getSettings, setSetting, toggleSetting } from '../services/settings.js';
import { isAdmin, isOwner, adminList, addAdmin, removeAdmin } from '../lib/auth.js';
import { setState, clearState } from '../lib/state.js';
import { config } from '../config.js';

const execAsync = promisify(exec);
export const adminHandler = new Composer();

/** Faqat adminlar uchun filtr */
adminHandler.use(async (ctx, next) => {
  const data = ctx.callbackQuery?.data;
  const isAdminCb = data?.startsWith('a:');
  const isAdminCmd = ctx.message?.text === '/admin' || ctx.message?.text === '⚙️ Admin panel';
  if (!isAdminCb && !isAdminCmd) return next();
  if (!(await isAdmin(ctx.from?.id))) {
    if (isAdminCb) return ctx.answerCallbackQuery({ text: '⛔ Ruxsat yo\'q', show_alert: true });
    return; // jim
  }
  return next();
});

const show = async (ctx, text, kb = adminMain()) => {
  const opts = { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } };
  if (ctx.callbackQuery) {
    try { return await ctx.editMessageText(text, opts); } catch { /* rasm/edit bo'lmadi */ }
  }
  return ctx.reply(text, opts);
};

async function panelText() {
  const u = await Users.userStats();
  const m = await Movies.movieStats();
  const req = await Requests.countRequests('new');
  return (
    '👑 <b>Admin panel</b>\n\n' +
    `👥 Foydalanuvchi: <b>${nf(u.total)}</b> (faol ${nf(u.active)})\n` +
    `🎬 Kino: <b>${nf(m.active)}</b>\n` +
    `📩 Yangi so'rov: <b>${nf(req)}</b>\n` +
    `🕐 ${fmtDate(new Date())}`
  );
}

adminHandler.command('admin', async (ctx) => show(ctx, await panelText()));
adminHandler.hears('⚙️ Admin panel', async (ctx) => show(ctx, await panelText()));
adminHandler.callbackQuery('a:home', async (ctx) => { await ctx.answerCallbackQuery(); await show(ctx, await panelText()); });

adminHandler.callbackQuery('a:cancel', async (ctx) => {
  await clearState(ctx.from.id);
  await ctx.answerCallbackQuery({ text: 'Bekor qilindi' });
  await show(ctx, await panelText());
});

// ---------------- Statistika ----------------
adminHandler.callbackQuery('a:stats', async (ctx) => {
  await ctx.answerCallbackQuery();
  const u = await Users.userStats();
  const m = await Movies.movieStats();
  const top = await Movies.top(5);
  let text =
    '📊 <b>Statistika</b>\n\n' +
    '<b>👥 Foydalanuvchilar</b>\n' +
    `• Jami: <b>${nf(u.total)}</b>\n` +
    `• Faol: <b>${nf(u.active)}</b>  |  Botni bloklagan: <b>${nf(u.stopped)}</b>\n` +
    `• Bugun qo'shilgan: <b>${nf(u.today)}</b>  |  7 kunda: <b>${nf(u.week)}</b>\n` +
    `• Kunlik aktiv (24s): <b>${nf(u.dau)}</b>\n` +
    `• Bloklangan: <b>${nf(u.blocked)}</b>\n\n` +
    '<b>🎬 Kinolar</b>\n' +
    `• Jami: <b>${nf(m.total)}</b> (faol ${nf(m.active)})\n` +
    `• Umumiy ko'rish: <b>${nf(m.views)}</b>\n` +
    `• Bugun yuborilgan: <b>${nf(m.watched_today)}</b>\n\n` +
    '<b>🔎 Qidiruv</b>\n' +
    `• Bugun: <b>${nf(m.searches_today)}</b>\n` +
    `• 7 kunda topilmagan: <b>${nf(m.notfound_week)}</b>\n`;
  if (top.length) {
    text += '\n<b>🔥 TOP 5 kino</b>\n';
    top.forEach((x, i) => { text += `${i + 1}. ${esc(x.title || x.code)} — ${nf(x.views)} 👁\n`; });
  }
  await show(ctx, text, new InlineKeyboard().text('🔄 Yangilash', 'a:stats').row().text('◀️ Orqaga', 'a:home'));
});

// ---------------- Qidiruv tahlili ----------------
adminHandler.callbackQuery('a:searches', async (ctx) => {
  await ctx.answerCallbackQuery();
  const topQ = await Movies.topSearches(10);
  const nf2 = await Movies.notFoundSearches(15);
  let text = '🔎 <b>Qidiruv tahlili</b>\n\n<b>Eng ko\'p qidirilganlar (30 kun)</b>\n';
  if (!topQ.length) text += '<i>ma\'lumot yo\'q</i>\n';
  topQ.forEach((r, i) => { text += `${i + 1}. ${esc(r.query)} — ${nf(r.c)}x ${r.found ? '✅' : '❌'}\n`; });
  text += '\n<b>❌ Topilmagan so\'rovlar</b> (shu kinolarni qo\'shish kerak!)\n';
  if (!nf2.length) text += '<i>yo\'q</i>\n';
  nf2.forEach((r, i) => { text += `${i + 1}. <code>${esc(r.query)}</code> — ${nf(r.c)}x\n`; });
  await show(ctx, text, new InlineKeyboard().text('🔄 Yangilash', 'a:searches').row().text('◀️ Orqaga', 'a:home'));
});

// ---------------- So'rovlar ----------------
adminHandler.callbackQuery(/^a:req:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const page = Number(ctx.match[1]);
  const per = 5;
  const total = await Requests.countRequests('new');
  const list = await Requests.listRequests('new', per, page * per);
  let text = `📩 <b>Kino so'rovlari</b> (yangi: ${nf(total)})\n\n`;
  if (!list.length) text += '<i>Yangi so\'rov yo\'q.</i>';
  const kb = new InlineKeyboard();
  list.forEach((r) => {
    text += `<b>#${r.id}</b> ${esc(r.text)}\n   👤 ${esc(r.first_name || '-')}${r.username ? ` @${esc(r.username)}` : ''} • ${fmtDate(r.created_at)}\n\n`;
    kb.text(`✅ #${r.id}`, `a:reqdone:${r.id}`).text(`🗑 #${r.id}`, `a:reqdel:${r.id}`).row();
  });
  const pages = Math.max(1, Math.ceil(total / per));
  if (pages > 1) {
    if (page > 0) kb.text('◀️', `a:req:${page - 1}`);
    kb.text(`${page + 1}/${pages}`, 'noop');
    if (page < pages - 1) kb.text('▶️', `a:req:${page + 1}`);
    kb.row();
  }
  kb.text('◀️ Orqaga', 'a:home');
  await show(ctx, text, kb);
});

adminHandler.callbackQuery(/^a:reqdone:(\d+)$/, async (ctx) => {
  const r = await Requests.setRequestStatus(Number(ctx.match[1]), 'done');
  await ctx.answerCallbackQuery({ text: '✅ Bajarildi deb belgilandi' });
  if (r) {
    await ctx.api.sendMessage(r.user_id, `✅ So'ragan kinongiz qo'shildi: <b>${esc(r.text)}</b>\n\nQidirib ko'ring 🍿`, { parse_mode: 'HTML' }).catch(() => {});
  }
});

adminHandler.callbackQuery(/^a:reqdel:(\d+)$/, async (ctx) => {
  await Requests.setRequestStatus(Number(ctx.match[1]), 'rejected');
  await ctx.answerCallbackQuery({ text: '🗑 O\'chirildi' });
});

// ---------------- Sozlamalar ----------------
async function settingsView(ctx) {
  const s = await getSettings();
  const on = (v) => (v ? '🟢 Yoniq' : '🔴 O\'chiq');
  const text =
    '⚙️ <b>Sozlamalar</b>\n\n' +
    `• Majburiy obuna: <b>${on(s.force_sub)}</b>\n` +
    `• Faylni himoyalash (forward/saqlash bloki): <b>${on(s.protect_content)}</b>\n` +
    `• Avto-o'chirish: <b>${Number(s.auto_delete_min) > 0 ? s.auto_delete_min + ' daqiqa' : 'o\'chiq'}</b>\n` +
    `• Texnik xizmat rejimi: <b>${on(s.maintenance)}</b>\n` +
    `• Referal bilan obunani chetlab o'tish: <b>${Number(s.ref_bypass) > 0 ? s.ref_bypass + ' ta do\'st' : 'o\'chiq'}</b>\n` +
    `• Kunlik kino limiti: <b>${Number(s.daily_limit) > 0 ? s.daily_limit + ' ta/kun' : 'cheksiz'}</b>\n` +
    `• 🎬 Kun kinosi: <b>${on(s.daily_movie)}</b> (${s.daily_movie_hour}:00)${s.daily_movie_broadcast ? ' + obunachilarga' : ''}\n` +
    `• 🏆 Haftalik TOP posti: <b>${on(s.weekly_top)}</b>\n` +
    `• 🥇 Referal liga posti: <b>${on(s.ref_league)}</b>\n` +
    `• 👥 Guruhlarda javob berish: <b>${on(s.group_mode)}</b>\n`;
  const kb = new InlineKeyboard()
    .text(`${s.force_sub ? '🔴 O\'chirish' : '🟢 Yoqish'}: majburiy obuna`, 'a:set:force_sub').row()
    .text(`${s.protect_content ? '🔴 O\'chirish' : '🟢 Yoqish'}: fayl himoyasi`, 'a:set:protect_content').row()
    .text('⏳ Avto-o\'chirish vaqti', 'a:set:autodel').row()
    .text(`${s.maintenance ? '🟢 Ishga qaytarish' : '🛠 Texnik xizmat'}`, 'a:set:maintenance').row()
    .text('👥 Referal chegarasi', 'a:set:refbypass').row()
    .text('🚦 Kunlik kino limiti', 'a:set:daily').row()
    .text(`${s.daily_movie ? '🔴' : '🟢'} Kun kinosi`, 'a:set:daily_movie')
    .text('🕐 Soati', 'a:set:dmhour').row()
    .text(`${s.daily_movie_broadcast ? '🔴' : '🟢'} Kun kinosi obunachilarga`, 'a:set:daily_movie_broadcast').row()
    .text(`${s.weekly_top ? '🔴' : '🟢'} Haftalik TOP`, 'a:set:weekly_top')
    .text(`${s.ref_league ? '🔴' : '🟢'} Liga`, 'a:set:ref_league').row()
    .text(`${s.group_mode ? '🔴' : '🟢'} Guruh rejimi`, 'a:set:group_mode').row()
    .text('🎬 Kun kinosini hozir yuborish', 'a:dmnow').row()
    .text('◀️ Orqaga', 'a:home');
  return show(ctx, text, kb);
}

adminHandler.callbackQuery('a:settings', async (ctx) => { await ctx.answerCallbackQuery(); await settingsView(ctx); });

adminHandler.callbackQuery(/^a:set:(force_sub|protect_content|maintenance|daily_movie|daily_movie_broadcast|weekly_top|ref_league|group_mode)$/, async (ctx) => {
  const v = await toggleSetting(ctx.match[1]);
  await ctx.answerCallbackQuery({ text: v ? 'Yoqildi' : 'O\'chirildi' });
  await settingsView(ctx);
});

adminHandler.callbackQuery('a:set:dmhour', async (ctx) => {
  await ctx.answerCallbackQuery();
  await setState(ctx.from.id, { step: 'set_dmhour' });
  await show(ctx, '🕐 Kun kinosi soat nechchida yuborilsin? (0–23, Toshkent vaqti)', cancelKb());
});

adminHandler.callbackQuery('a:dmnow', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Yuborilmoqda...' });
  const { runDailyMovie } = await import('../cron.js');
  try {
    const r = await runDailyMovie(ctx.api, { force: true });
    await ctx.reply(r ? `✅ Kun kinosi yuborildi: <b>${esc(r.title || r.code)}</b>` : '❌ Yuboriladigan kino topilmadi.', { parse_mode: 'HTML' });
  } catch (e) {
    await ctx.reply(`❌ Xato: ${esc(e.description || e.message)}`, { parse_mode: 'HTML' });
  }
});

adminHandler.callbackQuery('a:set:autodel', async (ctx) => {
  await ctx.answerCallbackQuery();
  await setState(ctx.from.id, { step: 'set_autodel' });
  await show(ctx, '⏳ Yuborilgan kino necha daqiqadan keyin o\'chirilsin?\n\nRaqam yuboring (0 = o\'chirmaslik):', cancelKb());
});

adminHandler.callbackQuery('a:set:daily', async (ctx) => {
  await ctx.answerCallbackQuery();
  await setState(ctx.from.id, { step: 'set_daily' });
  await show(ctx, '🚦 Bitta foydalanuvchi kunda nechta kino olsin?\n\nRaqam yuboring (0 = cheksiz):', cancelKb());
});

adminHandler.callbackQuery('a:set:refbypass', async (ctx) => {
  await ctx.answerCallbackQuery();
  await setState(ctx.from.id, { step: 'set_refbypass' });
  await show(ctx, '👥 Necha ta do\'st taklif qilgan foydalanuvchi obunasiz foydalansin?\n\nRaqam yuboring (0 = o\'chiq):', cancelKb());
});

// ---------------- Adminlar ----------------
adminHandler.callbackQuery('a:admins', async (ctx) => {
  await ctx.answerCallbackQuery();
  const list = await adminList();
  let text = '👤 <b>Adminlar</b>\n\n';
  const kb = new InlineKeyboard();
  list.forEach((a) => {
    text += `• <code>${a.user_id}</code> ${a.env ? '(asosiy, .env)' : ''} ${a.username ? '@' + esc(a.username) : esc(a.first_name || '')}\n`;
    if (!a.env) kb.text(`🗑 ${a.user_id}`, `a:admindel:${a.user_id}`).row();
  });
  if (isOwner(ctx.from.id)) kb.text('➕ Admin qo\'shish', 'a:adminadd').row();
  kb.text('◀️ Orqaga', 'a:home');
  await show(ctx, text, kb);
});

adminHandler.callbackQuery('a:adminadd', async (ctx) => {
  if (!isOwner(ctx.from.id)) return ctx.answerCallbackQuery({ text: 'Faqat asosiy admin', show_alert: true });
  await ctx.answerCallbackQuery();
  await setState(ctx.from.id, { step: 'admin_add' });
  await show(ctx, '➕ Yangi adminning <b>ID</b> raqamini yuboring.\n\n<i>ID ni bilish uchun u /id buyrug\'ini bossin.</i>', cancelKb());
});

adminHandler.callbackQuery(/^a:admindel:(\d+)$/, async (ctx) => {
  if (!isOwner(ctx.from.id)) return ctx.answerCallbackQuery({ text: 'Faqat asosiy admin', show_alert: true });
  await removeAdmin(Number(ctx.match[1]));
  await ctx.answerCallbackQuery({ text: 'O\'chirildi' });
  await ctx.api.sendMessage(Number(ctx.match[1]), '⛔ Sizning admin huquqingiz olib tashlandi.').catch(() => {});
});

// ---------------- Referal liga (admin) ----------------
adminHandler.callbackQuery('a:league', async (ctx) => {
  await ctx.answerCallbackQuery();
  const week = await Users.weeklyReferrers(10);
  const all = await Users.allTimeReferrers(10);
  const row = (r, i) => `${i + 1}. ${r.username ? '@' + esc(r.username) : esc(r.first_name || '-')} <code>${r.user_id}</code> — <b>${nf(r.invited)}</b>\n`;
  let text = '🏆 <b>Referal liga</b>\n\n<b>Bu hafta:</b>\n';
  text += week.length ? week.map(row).join('') : '<i>yo\'q</i>\n';
  text += '\n<b>Umumiy:</b>\n';
  text += all.length ? all.map(row).join('') : '<i>yo\'q</i>\n';
  await show(ctx, text, new InlineKeyboard().text('📣 Kanalga joylash', 'a:leaguepost').row().text('◀️ Orqaga', 'a:home'));
});

adminHandler.callbackQuery('a:leaguepost', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Joylanmoqda...' });
  const { postLeague } = await import('../cron.js');
  try {
    await postLeague(ctx.api);
    await ctx.reply('📣 Liga natijalari kanalga joylandi.');
  } catch (e) {
    await ctx.reply(`❌ ${esc(e.description || e.message)}`, { parse_mode: 'HTML' });
  }
});

// ---------------- Bazani tekshirish ----------------
adminHandler.callbackQuery('a:check', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Tekshirilmoqda...' });
  const a = await Movies.audit();
  const block = (title, rows, fmt) => {
    if (!rows.length) return `${title}: ✅ muammo yo'q\n`;
    return `${title}: <b>${rows.length}</b>\n` + rows.slice(0, 8).map(fmt).join('') + (rows.length > 8 ? '   <i>…</i>\n' : '');
  };
  let text = '🔍 <b>Baza tekshiruvi</b>\n\n';
  text += block('1️⃣ Bir xil nomli kinolar', a.dupTitles, (r) => `   • ${esc(r.title)} → <code>${r.codes.join('</code>, <code>')}</code>\n`);
  text += block('2️⃣ Aynan bir xil fayl', a.dupFiles, (r) => `   • <code>${r.codes.join('</code>, <code>')}</code>\n`);
  text += block('3️⃣ Nomi aniqlanmagan', a.noTitle, (r) => `   • <code>${esc(r.code)}</code>\n`);
  text += block('4️⃣ Izohida kod yo\'q', a.noCode, (r) => `   • <code>${esc(r.code)}</code>\n`);
  text += block('5️⃣ Yil yoki janr yo\'q', a.noMeta, (r) => `   • <code>${esc(r.code)}</code>\n`);
  text += block('6️⃣ O\'chirib qo\'yilgan', a.inactive, (r) => `   • <code>${esc(r.code)}</code>\n`);
  text += block('7️⃣ 14 kundan beri hech kim ko\'rmagan', a.zero, (r) => `   • <code>${esc(r.code)}</code>\n`);
  text += '\n💡 Kodni tugma bilan ochish uchun: 🎬 Kinolar → 🔎 Kod/nom bo\'yicha topish';
  await show(ctx, text, new InlineKeyboard().text('🔄 Qayta tekshirish', 'a:check').row().text('◀️ Orqaga', 'a:home'));
});

// ---------------- Zaxira ----------------
adminHandler.callbackQuery('a:backup', async (ctx) => {
  await ctx.answerCallbackQuery({ text: 'Zaxira olinmoqda...' });
  try {
    const file = await makeBackup();
    await ctx.replyWithDocument(new InputFile(file), {
      caption: `💾 Zaxira — ${fmtDate(new Date())}`,
    });
    if (config.secretChannel) {
      await ctx.api.sendDocument(config.secretChannel, new InputFile(file), {
        caption: `💾 Kinobot zaxirasi — ${fmtDate(new Date())}`,
      }).catch((e) => console.warn('[backup] maxfiy kanalga yuborilmadi:', e.message));
    }
    fs.unlink(file, () => {});
  } catch (e) {
    await ctx.reply(`❌ Zaxira xatosi: ${esc(e.message)}`, { parse_mode: 'HTML' });
  }
});

export async function makeBackup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
  const file = path.join(os.tmpdir(), `kinobot-${stamp}.sql.gz`);
  await execAsync(`pg_dump "${config.databaseUrl}" | gzip -9 > "${file}"`, { maxBuffer: 1024 * 1024 * 64 });
  return file;
}

// ---------------- Foydalanuvchi boshqaruvi ----------------
adminHandler.command('block', async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return;
  const id = Number((ctx.match || '').trim());
  if (!id) return ctx.reply('Foydalanish: /block 123456789');
  await Users.setBlocked(id, true);
  await ctx.reply(`⛔ <code>${id}</code> bloklandi.`, { parse_mode: 'HTML' });
});

adminHandler.command('unblock', async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return;
  const id = Number((ctx.match || '').trim());
  if (!id) return ctx.reply('Foydalanish: /unblock 123456789');
  await Users.setBlocked(id, false);
  await ctx.reply(`✅ <code>${id}</code> blokdan chiqarildi.`, { parse_mode: 'HTML' });
});

adminHandler.command('user', async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return;
  const id = Number((ctx.match || '').trim());
  const u = id ? await Users.getUser(id) : null;
  if (!u) return ctx.reply('Topilmadi. Foydalanish: /user 123456789');
  await ctx.reply(
    `👤 <b>${esc(u.first_name || '')}</b> ${u.username ? '@' + esc(u.username) : ''}\n` +
    `ID: <code>${u.user_id}</code>\n` +
    `Qidiruv: ${nf(u.search_count)} | Ko'rgan: ${nf(u.watch_count)}\n` +
    `Referal: ${nf(u.ref_count)}\n` +
    `Holati: ${u.is_blocked ? '⛔ bloklangan' : u.is_stopped ? '🚫 botni bloklagan' : '✅ faol'}\n` +
    `Qo'shilgan: ${fmtDate(u.created_at)}\nOxirgi aktivlik: ${fmtDate(u.last_seen_at)}`,
    { parse_mode: 'HTML' },
  );
});

/** settings wizard javoblari */
export async function handleSettingState(ctx, state, text) {
  const n = Number(String(text).trim());
  if (!Number.isFinite(n) || n < 0) { await ctx.reply('❌ Faqat 0 yoki musbat raqam yuboring.'); return true; }
  if (state.step === 'set_autodel') {
    await setSetting('auto_delete_min', Math.min(n, 1440));
    await clearState(ctx.from.id);
    await ctx.reply(`✅ Avto-o'chirish: ${n > 0 ? n + ' daqiqa' : 'o\'chiq'}`, { reply_markup: mainMenu(true) });
    return true;
  }
  if (state.step === 'set_daily') {
    await setSetting('daily_limit', Math.min(n, 1000));
    await clearState(ctx.from.id);
    await ctx.reply(`✅ Kunlik limit: ${n > 0 ? n + ' ta/kun' : 'cheksiz'}`, { reply_markup: mainMenu(true) });
    return true;
  }
  if (state.step === 'set_dmhour') {
    if (n > 23) { await ctx.reply('❌ 0 dan 23 gacha raqam yuboring.'); return true; }
    await setSetting('daily_movie_hour', n);
    await clearState(ctx.from.id);
    await ctx.reply(`✅ Kun kinosi har kuni ${n}:00 da yuboriladi.`, { reply_markup: mainMenu(true) });
    return true;
  }
  if (state.step === 'set_refbypass') {
    await setSetting('ref_bypass', Math.min(n, 100));
    await clearState(ctx.from.id);
    await ctx.reply(`✅ Referal chegarasi: ${n > 0 ? n + ' ta' : 'o\'chiq'}`, { reply_markup: mainMenu(true) });
    return true;
  }
  if (state.step === 'admin_add') {
    if (!Number.isInteger(n) || n < 10000) { await ctx.reply('❌ To\'g\'ri ID yuboring.'); return true; }
    await addAdmin(n, ctx.from.id);
    await clearState(ctx.from.id);
    await ctx.reply(`✅ <code>${n}</code> admin qilib qo'shildi.`, { parse_mode: 'HTML', reply_markup: mainMenu(true) });
    await ctx.api.sendMessage(n, '👑 Sizga admin huquqi berildi! /admin').catch(() => {});
    return true;
  }
  return false;
}
