import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* A DATE column is a calendar day. node-postgres would otherwise turn it into a
   Date at *local* midnight, which serialises back as the previous day for
   anyone east of UTC — every entry would slide by one. Hand it back verbatim. */
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v);

let pool = null;

export function db() {
  if (!pool) throw new Error('Database not connected yet');
  return pool;
}

export const query = (text, params) => db().query(text, params);

/** First row, or null. */
export async function one(text, params) {
  const { rows } = await query(text, params);
  return rows[0] || null;
}

/** All rows. */
export async function many(text, params) {
  const { rows } = await query(text, params);
  return rows;
}

export async function connect(url) {
  if (!url) {
    throw new Error('DATABASE_URL is not set — copy .env.example to .env and paste your Neon connection string');
  }
  if (url.includes('<password>') || url.includes('<db_password>')) {
    throw new Error('DATABASE_URL still contains a password placeholder — put your real Neon password in server/.env');
  }

  pool = new pg.Pool({
    connectionString: url,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });

  // A pooled connection dropped while idle must not take the process with it.
  pool.on('error', (err) => console.error('[db] idle client error:', err.message));

  const { rows } = await pool.query('select current_database() as name');
  console.log(`[db] connected to ${rows[0].name}`);

  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  return pool;
}

export async function disconnect() {
  await pool?.end();
  pool = null;
}
