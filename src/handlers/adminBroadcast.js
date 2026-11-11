import { Composer, InlineKeyboard } from 'grammy';
import { cancelKb, mainMenu } from '../lib/keyboards.js';
import { esc, nf, sleep } from '../lib/utils.js';
import * as Users from '../services/users.js';
import { setState, clearState, getState } from '../lib/state.js';
import { isAdmin } from '../lib/auth.js';

export const adminBroadcastHandler = new Composer();
const RATE = 20;          // sekundda nechta xabar
let running = false;

adminBroadcastHandler.callbackQuery('a:bc', async (ctx) => {
  await ctx.answerCallbackQuery();
  if (running) return ctx.reply('⏳ Avvalgi yuborish hali tugamadi.');
  await setState(ctx.from.id, { step: 'bc_wait' });
  const text =
    '📣 <b>Ommaviy xabar</b>\n\n' +
    'Yubormoqchi bo\'lgan xabarni (matn, rasm, video, tugmali post — farqi yo\'q) shu yerga tashlang.\n' +
    'Men uni avval sizga ko\'rsataman, keyin tasdiqlaysiz.';
  try { await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: cancelKb() }); }
  catch { await ctx.reply(text, { parse_mode: 'HTML', reply_markup: cancelKb() }); }
});

/** Har qanday xabarni broadcast uchun qabul qilish */
export async function handleBroadcastMessage(ctx, state) {
  if (state.step !== 'bc_wait') return false;
  const total = (await Users.activeUserIds()).length;
  await setState(ctx.from.id, { step: 'bc_confirm', chatId: ctx.chat.id, messageId: ctx.message.message_id });
  await ctx.reply(
    `👆 Shu xabar <b>${nf(total)}</b> foydalanuvchiga yuboriladi.\n\nTasdiqlaysizmi?`,
    {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('✅ Yuborish', 'a:bcgo').text('✖️ Bekor', 'a:cancel'),
      reply_parameters: { message_id: ctx.message.message_id },
    },
  );
  return true;
}

adminBroadcastHandler.callbackQuery('a:bcgo', async (ctx) => {
  if (!(await isAdmin(ctx.from.id))) return ctx.answerCallbackQuery({ text: '⛔', show_alert: true });
  const st = await getState(ctx.from.id);
  if (st?.step !== 'bc_confirm') return ctx.answerCallbackQuery({ text: 'Xabar topilmadi, qaytadan boshlang', show_alert: true });
  await clearState(ctx.from.id);
  await ctx.answerCallbackQuery({ text: 'Yuborish boshlandi' });
  runBroadcast(ctx, st).catch((e) => console.error('[broadcast]', e));
});

async function runBroadcast(ctx, st) {
  if (running) { await ctx.reply('⏳ Avvalgi yuborish hali tugamadi.'); return; }
  running = true;
  const ids = await Users.activeUserIds();
  let sent = 0, failed = 0, blocked = 0;
  const status = await ctx.reply(`📤 Yuborilmoqda... 0/${nf(ids.length)}`);

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    try {
      await ctx.api.copyMessage(id, st.chatId, st.messageId);
      sent++;
    } catch (e) {
      const code = e?.error_code;
      const d = String(e?.description || '');
      if (code === 403 || /bot was blocked|user is deactivated|chat not found/i.test(d)) {
        blocked++;
        await Users.markStopped(id).catch(() => {});
      } else if (code === 429) {
        const wait = (e.parameters?.retry_after || 3) + 1;
        await sleep(wait * 1000);
        i--; // qaytadan urinib ko'ramiz
        continue;
      } else {
        failed++;
      }
    }
    if (i % RATE === RATE - 1) await sleep(1000);
    if (i % 100 === 99) {
      await ctx.api.editMessageText(status.chat.id, status.message_id, `📤 Yuborilmoqda... ${nf(i + 1)}/${nf(ids.length)}`).catch(() => {});
    }
  }

  running = false;
  await ctx.api.editMessageText(
    status.chat.id, status.message_id,
    `✅ <b>Yuborish tugadi</b>\n\n📬 Yetib bordi: <b>${nf(sent)}</b>\n🚫 Bloklagan: <b>${nf(blocked)}</b>\n⚠️ Xato: <b>${nf(failed)}</b>`,
    { parse_mode: 'HTML' },
  ).catch(() => {});
  await ctx.reply('🏠 Admin panel', { reply_markup: mainMenu(true) });
}

/** Yangi kino haqida obunachilarga xabar */
export async function broadcastNewMovie(ctx, movie) {
  if (running) { await ctx.reply('⏳ Avvalgi yuborish hali tugamadi.'); return; }
  running = true;
  const ids = await Users.activeUserIds({ onlyNotify: true });
  const text =
    `🆕 <b>Yangi kino qo'shildi!</b>\n\n🎬 <b>${esc(movie.title || '-')}</b>` +
    `${movie.year ? ` (${movie.year})` : ''}\n` +
    `${movie.genres?.length ? `🎭 ${esc(movie.genres.join(', '))}\n` : ''}` +
    `${movie.quality ? `💿 ${esc(movie.quality)}\n` : ''}` +
    `\n🔢 Kod: <code>${esc(movie.code)}</code>`;
  const kb = new InlineKeyboard().text('🍿 Ko\'rish', `m:get:${movie.code}`);

  let sent = 0, blocked = 0;
  const status = await ctx.reply(`📤 Obunachilarga xabar: 0/${nf(ids.length)}`);
  for (let i = 0; i < ids.length; i++) {
    try {
      await ctx.api.sendMessage(ids[i], text, { parse_mode: 'HTML', reply_markup: kb });
      sent++;
    } catch (e) {
      if (e?.error_code === 403) { blocked++; await Users.markStopped(ids[i]).catch(() => {}); }
      else if (e?.error_code === 429) { await sleep(((e.parameters?.retry_after || 3) + 1) * 1000); i--; continue; }
    }
    if (i % RATE === RATE - 1) await sleep(1000);
  }
  running = false;
  await ctx.api.editMessageText(
    status.chat.id, status.message_id,
    `✅ Xabar yuborildi: <b>${nf(sent)}</b> ta\n🚫 Bloklagan: ${nf(blocked)}`,
    { parse_mode: 'HTML' },
  ).catch(() => {});
}
