import { Composer, InlineKeyboard } from 'grammy';
import { config } from '../config.js';
import { mainMenu, botLink } from '../lib/keyboards.js';
import { esc } from '../lib/utils.js';
import * as Movies from '../services/movies.js';
import { requireSub, deliver } from './common.js';
import { notifyAdmins, fmtUser } from '../lib/notify.js';

export const startHandler = new Composer();

function welcomeText(ctx) {
  const name = esc(ctx.from.first_name || 'Foydalanuvchi');
  return (
    `🎬 <b>Tarjima Kinolar LS botiga xush kelibsiz, ${name}!</b>\n\n` +
    `Bu yerda <b>o'zbek tilidagi</b> kinolarni kod yoki nom bo'yicha topasiz.\n\n` +
    `📌 <b>Qanday ishlaydi:</b>\n` +
    `1️⃣ Kanalga obuna bo'ling\n` +
    `2️⃣ Kino <b>kodini</b> (masalan <code>11</code>) yoki <b>nomini</b> yuboring\n` +
    `3️⃣ Kino darhol keladi 🍿\n\n` +
    `💡 Istalgan chatda <code>@${config.username} kino nomi</code> deb yozib do'stlaringizga ulashishingiz mumkin.`
  );
}

/** /start — barcha deep-link parametrlari bilan */
startHandler.command('start', async (ctx) => {
  const payload = (ctx.match || '').toString().trim();

  // ?start=kino_<kod>  yoki  ?start=check_<kod>
  const codeMatch = payload.match(/^(?:kino|film|check)_(.+)$/i);
  if (codeMatch) {
    const code = codeMatch[1];
    if (!(await requireSub(ctx, `kino_${code}`))) return;
    const movie = await Movies.getByCode(code);
    if (!movie) {
      await ctx.reply('❌ Bu kod bo\'yicha kino topilmadi. Boshqa kod yuboring yoki nom bo\'yicha qidiring.', {
        reply_markup: mainMenu(ctx.isAdmin),
      });
      return;
    }
    await deliver(ctx, movie, 'deeplink');
    return;
  }

  // ?start=serial_<kod>
  const serMatch = payload.match(/^serial_(.+)$/i);
  if (serMatch) {
    const S = await import('../services/series.js');
    const { seriesCard } = await import('./series.js');
    const ser = await S.getByCode(serMatch[1]);
    if (!ser) {
      await ctx.reply('❌ Bu kod bo\'yicha serial topilmadi.', { reply_markup: mainMenu(ctx.isAdmin) });
      return;
    }
    await ctx.reply('🏠 Menyu', { reply_markup: mainMenu(ctx.isAdmin) });
    await seriesCard(ctx, ser.id, 0);
    return;
  }

  // ?start=gift_<id> — do'st sovg'asi
  const giftMatch = payload.match(/^gift_(\d+)$/i);
  if (giftMatch) {
    if (!(await requireSub(ctx, payload))) return;
    const Users = await import('../services/users.js');
    const g = await Users.claimGift(Number(giftMatch[1]), ctx.from.id);
    if (!g) {
      await ctx.reply(
        '🎁 Bu sovg\'a havolasi ishlamaydi — allaqachon olingan yoki o\'zingizga tegishli.\n\nKino kodini yuborib ham olishingiz mumkin.',
        { reply_markup: mainMenu(ctx.isAdmin) },
      );
      return;
    }
    const movie = await Movies.getById(g.movie_id);
    if (!movie) { await ctx.reply('❌ Kino topilmadi.'); return; }
    await ctx.reply(
      `🎁 <b>Sizga kino sovg'a qilindi!</b>\n\n🎬 ${esc(movie.title || movie.code)}`,
      { parse_mode: 'HTML', reply_markup: mainMenu(ctx.isAdmin) },
    );
    await deliver(ctx, movie, 'gift');
    await ctx.api.sendMessage(
      g.from_user,
      `🎁 Sovg'angiz qabul qilindi!\n\n🎬 <b>${esc(movie.title || movie.code)}</b>\n` +
      `👤 ${esc(ctx.from.first_name || '')}${ctx.from.username ? ' (@' + esc(ctx.from.username) + ')' : ''}\n\n` +
      `✅ Sizga <b>+1 bonus</b> berildi (bugungi limitga qo'shiladi).`,
      { parse_mode: 'HTML' },
    ).catch(() => {});
    return;
  }

  if (/^search$/i.test(payload)) {
    await ctx.reply('🔍 Kino <b>kodini</b> yoki <b>nomini</b> yuboring:', {
      parse_mode: 'HTML',
      reply_markup: mainMenu(ctx.isAdmin),
    });
    return;
  }

  // Referal: ?start=ref_<id>  (faqat yangi foydalanuvchida hisoblanadi — upsertUser ichida)
  if (ctx.isNewUser && ctx.refBy) {
    await notifyAdmins(ctx.api, `👥 Yangi foydalanuvchi referal orqali: ${fmtUser(ctx.from)} ← <code>${ctx.refBy}</code>`).catch(() => {});
  }

  const kb = new InlineKeyboard()
    .text('🔍 Kino qidirish', 'm:search').text('🎲 Tasodifiy', 'm:random').row()
    .text('🆕 Yangi kinolar', 'm:latest:0').text('🔥 TOP 10', 'm:top').row()
    .text('📋 Qoidalar', 'm:rules').text('ℹ️ Bot haqida', 'm:about');

  await ctx.reply('🏠 Menyu ochildi.', { reply_markup: mainMenu(ctx.isAdmin) });
  if (config.welcomeImage) {
    try {
      await ctx.replyWithPhoto(config.welcomeImage, {
        caption: welcomeText(ctx), parse_mode: 'HTML', reply_markup: kb,
      });
      return;
    } catch (e) {
      console.warn('[start] welcome rasm yuborilmadi:', e.message);
    }
  }
  await ctx.reply(welcomeText(ctx), { parse_mode: 'HTML', reply_markup: kb, link_preview_options: { is_disabled: true } });
});

startHandler.command('help', async (ctx) => {
  await ctx.reply(
    '<b>ℹ️ Yordam</b>\n\n' +
    '• Kino <b>kodini</b> yuboring — masalan <code>11</code>\n' +
    '• Yoki kino <b>nomini</b> yozing — masalan <code>malefisenta</code>\n' +
    '• 🎲 Tasodifiy, 🔥 TOP 10, 🆕 Yangi kinolar tugmalaridan foydalaning\n' +
    '• ❤️ Sevimlilarga qo\'shib, keyin qaytib ko\'rishingiz mumkin\n' +
    '• Topilmasa 📩 <b>Kino so\'rash</b> tugmasi orqali so\'rov yuboring\n\n' +
    `• Ulashish: <code>@${config.username} kino nomi</code>\n\n` +
    '📞 Aloqa: @admin_username',
    { parse_mode: 'HTML', reply_markup: mainMenu(ctx.isAdmin) },
  );
});

startHandler.command('menu', async (ctx) => {
  await ctx.reply('🏠 Bosh menyu', { reply_markup: mainMenu(ctx.isAdmin) });
});

startHandler.command('id', async (ctx) => {
  await ctx.reply(`🆔 Sizning ID: <code>${ctx.from.id}</code>`, { parse_mode: 'HTML' });
});

startHandler.command('ref', async (ctx) => {
  await ctx.reply(
    `👥 <b>Referal havolangiz:</b>\n<code>${botLink('ref_' + ctx.from.id)}</code>\n\n` +
    `Taklif qilganlar: <b>${ctx.user?.ref_count ?? 0}</b> ta`,
    { parse_mode: 'HTML' },
  );
});
