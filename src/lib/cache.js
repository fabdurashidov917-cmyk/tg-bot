/** Oddiy TTL kesh (bitta process uchun yetarli) */
export class TTLCache {
  constructor(ttlMs = 300_000, max = 20_000) {
    this.ttl = ttlMs;
    this.max = max;
    this.map = new Map();
  }
  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (hit.exp < Date.now()) { this.map.delete(key); return undefined; }
    return hit.val;
  }
  set(key, val, ttl = this.ttl) {
    if (this.map.size >= this.max) {
      // eng eski 10% ni tozalash
      let i = 0;
      for (const k of this.map.keys()) { this.map.delete(k); if (++i > this.max / 10) break; }
    }
    this.map.set(key, { val, exp: Date.now() + ttl });
  }
  del(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}

/** Flood himoyasi: oynada N ta so'rov */
export class RateLimiter {
  constructor(limit = 5, windowMs = 3000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.hits = new Map();
    setInterval(() => {
      const now = Date.now();
      for (const [k, v] of this.hits) if (v.reset < now) this.hits.delete(k);
    }, 60_000).unref();
  }
  /** @returns {boolean} true = ruxsat, false = juda tez */
  take(key) {
    const now = Date.now();
    let rec = this.hits.get(key);
    if (!rec || rec.reset < now) { rec = { count: 0, reset: now + this.windowMs }; this.hits.set(key, rec); }
    rec.count += 1;
    return rec.count <= this.limit;
  }
  /** Faqat 1-marta ogohlantirish uchun */
  shouldWarn(key) {
    const rec = this.hits.get(key);
    return rec && rec.count === this.limit + 1;
  }
}
