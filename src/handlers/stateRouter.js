import { Composer } from 'grammy';
import { getState, clearState } from '../lib/state.js';
import { BTN } from '../lib/keyboards.js';
import { handleMovieFile, handleMovieText, extractFile, handleVariantFile, handleVariantLabel, handlePosterFile } from './adminMovies.js';
import { handleChannelText } from './adminChannels.js';
import { handleBroadcastMessage } from './adminBroadcast.js';
import { handleSettingState } from './admin.js';
import { handleSeriesText, handleEpisodeFile } from './adminSeries.js';
import { handleRequestText } from './menu.js';

export const stateRouter = new Composer();
const MENU_TEXTS = new Set(Object.values(BTN));

stateRouter.on('message', async (ctx, next) => {
  if (!ctx.from) return next();
  const st = await getState(ctx.from.id);
  if (!st?.step) return next();

  const text = ctx.message.text?.trim();

  // Buyruq yoki menyu tugmasi — holatni bekor qilib, oddiy oqimga o'tamiz
  if (text && (text.startsWith('/') || MENU_TEXTS.has(text))) {
    await clearState(ctx.from.id);
    return next();
  }

  if (st.step === 'request') {
    if (!text) return ctx.reply('📩 Kino nomini <b>matn</b> ko\'rinishida yozing.', { parse_mode: 'HTML' });
    return handleRequestText(ctx, text);
  }

  if (!ctx.isAdmin) { await clearState(ctx.from.id); return next(); }

  if (st.step === 'bc_wait') {
    if (await handleBroadcastMessage(ctx, st)) return;
  }

  if (extractFile(ctx.message) && (st.step === 'movie_file' || st.step === 'movie_editfile')) {
    if (await handleMovieFile(ctx, st)) return;
  }

  if (st.step === 'movie_poster' || st.step === 'series_poster') {
    if (await handlePosterFile(ctx, st)) return;
  }

  if (st.step === 'episode_bulk' && extractFile(ctx.message)) {
    if (await handleEpisodeFile(ctx, st)) return;
  }

  if (st.step === 'variant_file') {
    if (await handleVariantFile(ctx, st)) return;
  }

  if (st.step === 'variant_label' && text) {
    if (await handleVariantLabel(ctx, st, text)) return;
  }

  if (text) {
    if (await handleSeriesText(ctx, st, text)) return;
    if (await handleMovieText(ctx, st, text)) return;
    if (await handleChannelText(ctx, st, text)) return;
    if (await handleSettingState(ctx, st, text)) return;
  }

  if (st.step === 'movie_poster' || st.step === 'series_poster') {
    return ctx.reply('🖼 Iltimos, <b>rasm</b> yuboring. Bekor qilish: /menu', { parse_mode: 'HTML' });
  }

  if (st.step === 'movie_file' || st.step === 'movie_editfile' || st.step === 'variant_file' || st.step === 'episode_bulk') {
    return ctx.reply('📎 Iltimos, <b>fayl</b> yuboring (video/hujjat/rasm/audio). Bekor qilish: /menu', { parse_mode: 'HTML' });
  }

  await clearState(ctx.from.id);
  return next();
});
