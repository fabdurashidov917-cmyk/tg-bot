import { GrammyError, HttpError } from 'grammy';
import { sleep } from './utils.js';

/**
 * Telegram API chaqiruvlarini himoyalash:
 *  • tarmoq uzilishi (ECONNRESET, timeout) — 3 martagacha qayta urinish
 *  • 429 (flood) — retry_after ni kutib qayta urinish
 *  • 5xx — qayta urinish
 * Shunisiz bitta uzilish butun ishlovchini yiqitardi.
 */
export function apiRetry({ maxAttempts = 3, baseDelayMs = 500 } = {}) {
  return async (prev, method, payload, signal) => {
    // "Ack" chaqiruvi: muvaffaqiyatsiz bo'lsa ham ishlovchi to'xtamasligi kerak.
    // (Telegram ba'zan "query is too old" qaytaradi yoki tarmoq uziladi —
    //  bu sababli asosiy ish bajarilmay qolardi.)
    const isAck = method === 'answerCallbackQuery';
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await prev(method, payload, signal);
        if (res.ok === false && res.error_code === 429) {
          const wait = ((res.parameters?.retry_after ?? 1) + 1) * 1000;
          if (attempt < maxAttempts) { await sleep(wait); continue; }
        }
        if (res.ok === false && res.error_code >= 500 && attempt < maxAttempts) {
          await sleep(baseDelayMs * attempt);
          continue;
        }
        if (isAck && res.ok === false) {
          console.warn(`[api] ack e'tiborsiz qoldirildi: ${res.description}`);
          return { ok: true, result: true };
        }
        return res;
      } catch (e) {
        lastErr = e;
        const retriable =
          e instanceof HttpError ||
          /ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up|network|timed out/i.test(String(e?.message));
        if (!retriable || attempt === maxAttempts) {
          if (isAck) {
            console.warn(`[api] ack xatosi e'tiborsiz qoldirildi: ${redactToken(e.message)}`);
            return { ok: true, result: true };
          }
          throw e;
        }
        console.warn(`[api] ${method} xatosi (${attempt}/${maxAttempts}): ${redactToken(e.message)} — qayta urinaman`);
        await sleep(baseDelayMs * attempt);
      }
    }
    throw lastErr;
  };
}

/** Log va xabarlarda bot tokeni ko'rinmasin */
export function redactToken(input) {
  const s = typeof input === 'string' ? input : String(input?.stack || input?.message || input);
  return s.replace(/bot\d{6,}:[\w-]{20,}/g, 'bot***TOKEN***');
}
