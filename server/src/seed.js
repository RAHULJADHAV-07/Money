import 'dotenv/config';
import mongoose from 'mongoose';
import { connect } from './db.js';
import User from './models/User.js';
import Transaction from './models/Transaction.js';
import Goal from './models/Goal.js';
import Settings from './models/Settings.js';
import { toDayUTC } from './lib/dates.js';

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
  await connect(process.env.MONGODB_URI);

  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: npm run seed -- your@email.com   (sign up in the app first)');
    process.exit(1);
  }
  const user = await User.findOne({ email });
  if (!user) {
    console.error(`No account found for ${email}. Sign up in the app first, then re-run this.`);
    process.exit(1);
  }

  const settings = await Settings.load(user._id);
  settings.categories = ['Housing', 'Food', 'Transport', 'Utilities', 'Entertainment', 'Health', 'Shopping', 'Misc'];
  settings.sources = ['Salary', 'Freelance', 'Investment', 'Mom', 'Dad', 'Other'];
  await settings.save();
  console.log('[seed] settings ready');

  for (const g of GOALS) {
    const existing = await Goal.findOne({ name: g.name, user: user._id });
    if (existing) { console.log(`[seed] goal "${g.name}" already there`); continue; }
    await Goal.create({ ...g, user: user._id });
    console.log(`[seed] goal "${g.name}" created`);
  }

  for (const t of OPENING) {
    const dupe = await Transaction.findOne({ user: user._id, kind: t.kind, amount: t.amount, person: t.person || '', date: toDayUTC(t.date) });
    if (dupe) { console.log(`[seed] "${t.note}" already there`); continue; }
    await Transaction.create({ ...t, user: user._id, date: toDayUTC(t.date), method: 'Cash' });
    console.log(`[seed] added ${t.kind} ${t.amount} ${t.person || t.source}`);
  }

  await mongoose.disconnect();
  console.log('[seed] done');
}

run().catch((err) => { console.error('[seed] ' + err.message); process.exit(1); });
