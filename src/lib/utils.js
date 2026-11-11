// Umumiy yordamchi funksiyalar

/** Telegram HTML parse_mode uchun xavfsiz qilish. Foydalanuvchi matni SHART. */
export function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/** SQL LIKE/ILIKE uchun wildcard larni zararsizlantirish */
export function likeEscape(s) {
  return String(s ?? '').replace(/([\\%_])/g, '\\$1');
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const EMOJI_PREFIX = /^[\s\p{Extended_Pictographic}\p{So}\p{Sk}️⃣•·\-—–➖*#]+/u;
const EMOJI_ALL = /[\p{Extended_Pictographic}\p{So}️⃣]/gu;

export const stripEmoji = (s) => String(s ?? '').replace(EMOJI_PREFIX, '').trim();

const KEYS = [
  ['title',   /^(?:nom(?:i|lari)?|film\s*nomi)$/i],
  ['country', /^(?:davlat(?:i)?|mamlakat(?:i)?)$/i],
  ['lang',    /^(?:til(?:i)?|ovoz(?:i)?)$/i],
  ['genres',  /^(?:janr(?:i|lari)?)$/i],
  ['quality', /^(?:sifat(?:i)?)$/i],
  ['year',    /^(?:yil(?:i)?)$/i],
  ['rating',  /^(?:reyting(?:i)?|baho(?:si)?)$/i],
  ['code',    /^(?:kod(?:i)?)$/i],
];

/**
 * Kino captionidan meta ma'lumotlarni ajratib oladi.
 * Turli formatlarni qo'llaydi: "🎬 Nomi: X", "📷 X", "🌐 Davlati: X", "🇺🇸• Davlati: X" ...
 */
export function parseCaption(caption) {
  const out = { title: null, country: null, lang: null, quality: null, year: null, rating: null, code: null, genres: [] };
  if (!caption) return out;

  const lines = String(caption).split('\n');
  const plainLines = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const m = line.match(/^(.{1,30}?)\s*[:：]\s*(.+)$/);
    let matched = false;
    if (m) {
      const key = stripEmoji(m[1]).replace(/[•·*]/g, '').trim().toLowerCase();
      const rawVal = m[2].trim();
      const val = stripEmoji(m[2]);
      for (const [name, re] of KEYS) {
        if (re.test(key)) {
          if (name === 'genres') out.genres = parseGenres(rawVal);
          else if (name === 'year') out.year = pickYear(val);
          else if (!out[name]) out[name] = val;
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      // Sarlavha bo'lishi mumkin bo'lgan qator
      const t = stripEmoji(line);
      const onlySep = !t || /^[➖\-—–=_.\s|]+$/.test(t) || !/\p{L}|\p{N}/u.test(t);
      const isJunk = /^@|^(?:eng\s|iltimos|reklama|👉|obuna)/i.test(t) || /t\.me\//i.test(t);
      if (!onlySep && !isJunk) plainLines.push(t);
    }
    if (!out.genres.length) {
      const tags = line.match(/#\p{L}[\p{L}\p{N}_]*/gu);
      if (tags && /janr/i.test(line)) out.genres = tags.map((x) => x.slice(1));
    }
  }

  if (!out.title && plainLines.length) out.title = plainLines[0];
  out.title = cleanTitle(out.title);
  if (!out.year) out.year = pickYear(caption);
  return out;
}

function parseGenres(val) {
  const tags = val.match(/#\p{L}[\p{L}\p{N}_]*/gu);
  if (tags) return dedupe(tags.map((t) => t.slice(1)));
  return dedupe(
    val.split(/[|,/•]+/).map((s) => stripEmoji(s).replace(/\s+/g, ' ').trim()).filter((s) => s && s.length < 30),
  );
}

const dedupe = (a) => [...new Set(a.map((s) => s.trim()).filter(Boolean))];

function pickYear(s) {
  const m = String(s ?? '').match(/\b(19\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

/** "A.N.K.l josuslari (2015) bluray 1080p" -> "A.N.K.l josuslari" */
function cleanTitle(t) {
  if (!t) return null;
  let s = String(t).replace(/\s+/g, ' ').trim();
  s = s.replace(/\s*\((?:19|20)\d{2}\)\s*.*$/i, '');
  s = s.replace(/\s*\b(?:bluray|bdrip|webrip|web-?dl|hdrip|dvdrip|camrip|\d{3,4}p)\b.*$/i, '');
  s = s.replace(/[\s\-–—|]+$/, '').trim();
  return s || null;
}

/** Kino uchun chiroyli sarlavha qatori */
export function movieLine(m, i) {
  const num = i === undefined ? '' : `${i}. `;
  const year = m.year ? ` (${m.year})` : '';
  return `${num}<b>${esc(m.title || 'Nomsiz')}</b>${year} — <code>${esc(m.code)}</code>`;
}

export function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('uz-UZ', {
    timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export const nf = (n) => new Intl.NumberFormat('en-US').format(Number(n || 0)).replace(/,/g, ' ');
