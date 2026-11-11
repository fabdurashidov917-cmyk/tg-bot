import pg from 'pg';
import { config } from './config.js';

// bigint (int8) -> Number. Bizdagi barcha bigint qiymatlar (user_id) xavfsiz diapazonda.
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (err) => console.error('[pg] kutilmagan xato:', err.message));

export const q = (text, params) => pool.query(text, params);
export const one = async (text, params) => (await pool.query(text, params)).rows[0] ?? null;
export const all = async (text, params) => (await pool.query(text, params)).rows;
