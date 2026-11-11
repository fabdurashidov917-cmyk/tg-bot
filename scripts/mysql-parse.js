/** MySQL dump INSERT larini o'qish (faqat import uchun yordamchi) */

export function unescapeMySql(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c !== '\\') { out += c; continue; }
    const n = s[++i];
    if (n === 'n') out += '\n';
    else if (n === 't') out += '\t';
    else if (n === 'r') out += '\r';
    else if (n === '0') out += '\0';
    else if (n === 'Z') out += '\x1a';
    else out += n;
  }
  return out;
}

/**
 * `INSERT INTO \`table\` (...) VALUES (..),(..);` dan tuple larni ajratadi.
 * Har bir qiymat {str: true|false, v: string} ko'rinishida qaytadi —
 * shunda '' (bo'sh satr) va NULL farqlanadi.
 */
export function parseInserts(sql, table) {
  const re = new RegExp('INSERT\\s+(?:IGNORE\\s+)?INTO\\s+`?' + table + '`?[^;]*?VALUES\\s*', 'gi');
  const rows = [];
  let m;
  while ((m = re.exec(sql))) {
    let i = m.index + m[0].length;
    let tuple = null;
    let buf = '';
    let isStr = false;
    let inStr = false;

    for (; i < sql.length; i++) {
      const c = sql[i];

      if (inStr) {
        if (c === '\\') { buf += c + (sql[++i] ?? ''); continue; }
        if (c === "'") { inStr = false; continue; }
        buf += c;
        continue;
      }

      if (c === '(' && tuple === null) { tuple = []; buf = ''; isStr = false; continue; }
      if (tuple === null) {
        if (c === ';') break;
        continue;                      // tuple lar orasidagi vergul/bo'shliq
      }
      if (c === "'") { inStr = true; isStr = true; continue; }
      if (c === ',') { tuple.push({ str: isStr, v: buf.trim() }); buf = ''; isStr = false; continue; }
      if (c === ')') { tuple.push({ str: isStr, v: buf.trim() }); rows.push(tuple); tuple = null; buf = ''; isStr = false; continue; }
      buf += c;
    }
    re.lastIndex = i;
  }
  return rows;
}

/** Qiymatni JS ga o'girish: NULL -> null, satr -> unescape */
export function val(cell) {
  if (!cell) return null;
  if (!cell.str) return /^null$/i.test(cell.v) ? null : cell.v;
  return unescapeMySql(cell.v);
}
