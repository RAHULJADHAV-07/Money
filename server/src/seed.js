import 'dotenv/config';
import { connect, disconnect, one } from './db.js';
import * as User from './models/User.js';
import * as Goal from './models/Goal.js';
import * as Settings from './models/Settings.js';
import * as Transaction from './models/Transaction.js';
import { toDayKey } from './lib/dates.js';

// Carries over what was already in "Personal Money CheckUp.xlsx" plus the
// goal buckets from "Hisab_Structure.xlsx". Safe to re-run: it only fills gaps.
const OPENING = [
  { kind: 'borrowed', person: 'MRM-Money', amount: 8469, date: '2026-08-24', note: 'Carried over from Debt Ledger' },
  { kind: 'lent',     person: 'MOM Help',  amount: 5700, date: '2026-08-24', note: 'Carried over from Debt Ledger' },
  { kind: 'income',   source: 'Other',     amount: 86,   date: '2026-08-24', note: 'Opening balance row' },
];

const GOALS = [
  { name: 'Emergency Fund',   target: 25000, color: '#2f9e6f' },
  { name: 'Trip Fund',        target: 15000, color: '#3b82f6' },
  { name: 'Health Insurance', target: 6000,  color: '#e0803a' },
];

async function run() {
  await connect(process.env.DATABASE_URL);

  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: npm run seed -- your@email.com   (sign up in the app first)');
    process.exitCode = 1;
    return;
  }
  const user = await User.findByEmail(email);
  if (!user) {
    console.error(`No account found for ${email}. Sign up in the app first, then re-run this.`);
    process.exitCode = 1;
    return;
  }

  await Settings.load(user.id);
  await Settings.save(user.id, {
    categories: ['Housing', 'Food', 'Transport', 'Utilities', 'Entertainment', 'Health', 'Shopping', 'Misc'],
    sources: ['Salary', 'Freelance', 'Investment', 'Mom', 'Dad', 'Other'],
  });
  console.log('[seed] settings ready');

  for (const g of GOALS) {
    if (await Goal.findByName(user.id, g.name)) { console.log(`[seed] goal "${g.name}" already there`); continue; }
    await Goal.create({ userId: user.id, ...g });
    console.log(`[seed] goal "${g.name}" created`);
  }

  for (const t of OPENING) {
    const dupe = await one(
      `select 1 from transactions
        where user_id = $1 and kind = $2 and amount = $3 and person = $4 and date = $5`,
      [user.id, t.kind, t.amount, t.person || '', toDayKey(t.date)]
    );
    if (dupe) { console.log(`[seed] "${t.note}" already there`); continue; }
    await Transaction.create(user.id, {
      kind: t.kind,
      amount: t.amount,
      date: toDayKey(t.date),
      category: '',
      source: t.source || '',
      person: t.person || '',
      goal: null,
      note: t.note,
      method: 'Cash',
      toMethod: '',
    });
    console.log(`[seed] added ${t.kind} ${t.amount} ${t.person || t.source}`);
  }

  console.log('[seed] done');
}

run()
  .catch((err) => { console.error('[seed] ' + err.message); process.exitCode = 1; })
  .finally(() => disconnect().catch(() => {}));
