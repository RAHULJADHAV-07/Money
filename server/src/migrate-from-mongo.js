import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { connect, disconnect, query, one } from './db.js';

/*
 * One-shot copy of the MongoDB data into Neon (Postgres).
 *
 *   npm run migrate:mongo            # copy everything
 *   npm run migrate:mongo -- --dry   # read and report, write nothing
 *
 * Safe to re-run: every row is keyed by its original Mongo _id and inserted
 * with ON CONFLICT DO NOTHING, so a second pass copies only what is missing.
 * A JSON dump of the source data is written next to the script first, so the
 * Mongo cluster can be switched off without losing the original.
 */
const DRY = process.argv.includes('--dry');
const id = (v) => (v == null ? null : String(v));

// Dates were stored at UTC midnight of the day the user picked; a DATE column
// wants exactly that day, with no clock and no zone attached.
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
const ts = (d) => (d ? new Date(d) : new Date());

async function run() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set — it is still needed to read the old data');

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
  const mdb = mongoose.connection.db;
  console.log(`[migrate] reading from mongo "${mongoose.connection.name}"`);

  const [users, goals, settings, transactions] = await Promise.all([
    mdb.collection('users').find({}).toArray(),
    mdb.collection('goals').find({}).toArray(),
    mdb.collection('settings').find({}).toArray(),
    mdb.collection('transactions').find({}).toArray(),
  ]);
  console.log(`[migrate] found ${users.length} users, ${goals.length} goals, ${settings.length} settings, ${transactions.length} transactions`);

  const backup = path.join(process.cwd(), `mongo-backup-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(backup, JSON.stringify({ users, goals, settings, transactions }, null, 2));
  console.log(`[migrate] source dumped to ${backup}`);

  await connect(process.env.DATABASE_URL);
  console.log('[migrate] schema ready');

  if (DRY) {
    console.log('[migrate] --dry: nothing written');
    return;
  }

  const skipped = [];
  const userIds = new Set(users.map((u) => id(u._id)));
  const goalIds = new Set();

  /* Order matters: a child row cannot land before the parent it references. */

  /* users and settings each carry two unique constraints (id plus email /
     user_id), and ON CONFLICT can only name one — so they are checked first. */
  let nUsers = 0;
  for (const u of users) {
    const email = String(u.email || '').toLowerCase();
    if (await one('select 1 from users where id = $1 or email = $2', [id(u._id), email])) continue;
    await query(
      `insert into users (id, name, email, password_hash, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6)`,
      [id(u._id), u.name || '', email, u.passwordHash || '', ts(u.createdAt), ts(u.updatedAt)]
    );
    nUsers++;
  }

  let nGoals = 0;
  for (const g of goals) {
    if (!userIds.has(id(g.user))) { skipped.push(`goal ${id(g._id)} "${g.name}" — no such user`); continue; }
    const r = await query(
      `insert into goals (id, user_id, name, target, color, archived, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8) on conflict (id) do nothing`,
      [id(g._id), id(g.user), g.name || '', Number(g.target) || 0, g.color || '#2f9e6f', !!g.archived, ts(g.createdAt), ts(g.updatedAt)]
    );
    goalIds.add(id(g._id));
    nGoals += r.rowCount;
  }

  let nSettings = 0;
  for (const s of settings) {
    if (!userIds.has(id(s.user))) { skipped.push(`settings ${id(s._id)} — no such user`); continue; }
    if (await one('select 1 from settings where id = $1 or user_id = $2', [id(s._id), id(s.user)])) continue;
    await query(
      `insert into settings (id, user_id, currency, opening_balance, categories, sources, methods,
                             budgets, opening_balances, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id(s._id), id(s.user), s.currency || '₹', Number(s.openingBalance) || 0,
        s.categories?.length ? s.categories : ['Housing', 'Food', 'Transport', 'Utilities', 'Entertainment', 'Health', 'Shopping', 'Misc'],
        s.sources?.length ? s.sources : ['Salary', 'Freelance', 'Investment', 'Mom', 'Dad', 'Other'],
        s.methods?.length ? s.methods : ['Cash', 'UPI', 'Bank', 'Card'],
        JSON.stringify(s.budgets || {}), JSON.stringify(s.openingBalances || {}),
        ts(s.createdAt), ts(s.updatedAt),
      ]
    );
    nSettings++;
  }

  let nTx = 0;
  let orphanGoals = 0;
  for (const t of transactions) {
    if (!userIds.has(id(t.user))) { skipped.push(`transaction ${id(t._id)} ${t.kind} ${t.amount} — no such user`); continue; }
    // A bucket deleted before the move leaves a dangling reference; the entry
    // still counts, it just falls back to unassigned savings.
    let goalId = id(t.goal);
    if (goalId && !goalIds.has(goalId)) { goalId = null; orphanGoals++; }

    const r = await query(
      `insert into transactions (id, user_id, date, kind, amount, category, source, person,
                                 goal_id, note, method, to_method, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       on conflict (id) do nothing`,
      [
        id(t._id), id(t.user), day(t.date), t.kind, Number(t.amount) || 0,
        t.category || '', t.source || '', t.person || '', goalId,
        t.note || '', t.method || 'Cash', t.toMethod || '', ts(t.createdAt), ts(t.updatedAt),
      ]
    );
    nTx += r.rowCount;
  }

  console.log(`[migrate] inserted  users ${nUsers}/${users.length}  goals ${nGoals}/${goals.length}  settings ${nSettings}/${settings.length}  transactions ${nTx}/${transactions.length}`);
  console.log('[migrate] (an insert of 0 means the row was already there — the copy is idempotent)');
  if (orphanGoals) console.log(`[migrate] ${orphanGoals} entries pointed at a deleted bucket — kept as unassigned savings`);
  for (const s of skipped) console.warn(`[migrate] skipped ${s}`);

  /* ── Verify ─────────────────────────────────────────────────────────────── */
  const counts = await one(`
    select (select count(*)::int from users) as users,
           (select count(*)::int from goals) as goals,
           (select count(*)::int from settings) as settings,
           (select count(*)::int from transactions) as transactions,
           (select coalesce(sum(amount), 0) from transactions) as amount_total`);
  const mongoTotal = transactions.reduce((n, t) => n + (Number(t.amount) || 0), 0);

  console.log('[verify] postgres rows:', JSON.stringify(counts));
  console.log(`[verify] amount total  mongo ${mongoTotal}  postgres ${counts.amount_total}  ${Math.abs(mongoTotal - counts.amount_total) < 0.005 ? 'MATCH' : 'MISMATCH'}`);
}

run()
  .then(() => console.log('[migrate] done'))
  .catch((err) => { console.error('[migrate] ' + err.message); process.exitCode = 1; })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
    await disconnect().catch(() => {});
  });
