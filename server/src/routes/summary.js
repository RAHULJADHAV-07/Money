import { Router } from 'express';
import * as Transaction from '../models/Transaction.js';
import * as Settings from '../models/Settings.js';
import { KINDS, dirOf, debtNet } from '../lib/kinds.js';
import { openingsFor, balancesFrom } from '../lib/wallets.js';
import { monthRange, lastMonths, toDayKey, dayKey, startOfToday } from '../lib/dates.js';
import { wrap } from '../lib/async.js';

const router = Router();

const sumBy = (rows) => rows.reduce((acc, r) => ({ ...acc, [r.kind]: r.total }), {});
const get = (map, k) => map[k] || 0;
const scoped = (rows, scope) => rows.filter((r) => r.scope === scope);

router.get('/', wrap(async (req, res) => {
  const userId = req.userId;
  const { start, end, key } = monthRange(req.query.month);
  const monthStart = dayKey(start);
  const monthEnd = dayKey(end);
  const today = req.query.today ? toDayKey(req.query.today) : dayKey(startOfToday());
  const trendKeys = lastMonths(key, 6);
  const trendStart = dayKey(monthRange(trendKeys[0]).start);

  const [settingsRow, kindRows, methodRows, catSourceRows, trendRows, personRows, recentRows, transferIn] =
    await Promise.all([
      Settings.load(userId),
      Transaction.kindTotals(userId, monthStart, monthEnd, today),
      Transaction.methodTotals(userId, monthStart, monthEnd),
      Transaction.categoryAndSource(userId, monthStart, monthEnd),
      Transaction.monthlyTrend(userId, trendStart, monthEnd),
      Transaction.personTotals(userId),
      Transaction.recent(userId, 8),
      Transaction.transferIn(userId),
    ]);

  const settings = Settings.toJSON(settingsRow);
  const allTime = scoped(kindRows, 'all');
  const methodAll = scoped(methodRows, 'all');
  const methodMonth = scoped(methodRows, 'month');
  const byCategory = catSourceRows.filter((r) => r.dim === 'category');
  const bySource = catSourceRows.filter((r) => r.dim === 'source');

  const all = sumBy(allTime);
  const month = sumBy(scoped(kindRows, 'month'));
  const day = sumBy(scoped(kindRows, 'day'));

  /* ── Wallets ───────────────────────────────────────────────────────────────
     Each wallet's balance is its opening figure, plus every entry that touched
     it, plus transfers that landed in it and minus transfers that left it.  */
  const openings = openingsFor(settings);
  const openingTotal = Object.values(openings).reduce((n, v) => n + (Number(v) || 0), 0);
  const methods = [...new Set([
    ...(settings.methods || []),
    ...methodAll.map((r) => r.method).filter(Boolean),
    ...Object.keys(openings),
    ...transferIn.map((r) => r.to_method).filter(Boolean),
  ])];

  const wallet = {};
  for (const m of methods) {
    wallet[m] = { name: m, opening: openings[m] || 0, balance: openings[m] || 0, in: 0, out: 0, monthIn: 0, monthOut: 0, count: 0 };
  }
  const walletOf = (m) => (wallet[m] ||= { name: m, opening: 0, balance: 0, in: 0, out: 0, monthIn: 0, monthOut: 0, count: 0 });

  for (const r of methodAll) {
    const w = walletOf(r.method || 'Cash');
    const d = dirOf(r.kind);
    w.count += r.count;
    if (r.kind === 'transfer') { w.balance -= r.total; w.out += r.total; continue; }
    w.balance += d * r.total;
    if (d > 0) w.in += r.total;
    if (d < 0) w.out += r.total;
  }
  // Transfers arriving in a wallet were counted as leaving the other one above.
  for (const r of transferIn) {
    const w = walletOf(r.to_method);
    w.balance += r.total;
    w.in += r.total;
  }
  for (const r of methodMonth) {
    const w = walletOf(r.method || 'Cash');
    const d = dirOf(r.kind);
    if (r.kind === 'transfer') { w.monthOut += r.total; continue; }
    if (d > 0) w.monthIn += r.total;
    if (d < 0) w.monthOut += r.total;
  }
  for (const r of transferIn) {
    if (r.month !== key) continue;
    walletOf(r.to_method).monthIn += r.total;
  }

  const wallets = Object.values(wallet).sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  const walletTotal = wallets.reduce((n, w) => n + w.balance, 0);

  // Cash in hand: opening balance plus every entry's signed effect.
  const balance = allTime.reduce((n, r) => n + (KINDS[r.kind]?.dir ?? 0) * r.total, openingTotal);
  const savings = get(all, 'saving_in') - get(all, 'saving_out');

  // Nets are computed per person first, so one settled friend never masks another's dues.
  const people = {};
  for (const row of personRows) {
    const p = (people[row.person] ||= {
      person: row.person, lent: 0, borrowed: 0,
      repay_received: 0, repay_paid: 0, settle_received: 0, settle_paid: 0,
    });
    p[row.kind] = row.total;
  }
  let toReceive = 0, toPay = 0;
  for (const p of Object.values(people)) {
    const { theyOweMe, iOweThem } = debtNet(p);
    toReceive += Math.max(0, theyOweMe);
    toPay += Math.max(0, iOweThem);
  }

  const trendMap = {};
  for (const r of trendRows) (trendMap[r.month] ||= {})[r.kind] = r.total;
  const trend = trendKeys.map((m) => ({
    month: m,
    income: (trendMap[m]?.income || 0) + (trendMap[m]?.repay_received || 0),
    expense: trendMap[m]?.expense || 0,
    saved: (trendMap[m]?.saving_in || 0) - (trendMap[m]?.saving_out || 0),
  }));

  const monthIncome = get(month, 'income');
  const monthExpense = get(month, 'expense');

  res.json({
    month: key,
    currency: settings.currency,
    cards: {
      balance,
      savings,
      toReceive,
      toPay,
      netWorth: balance + savings + toReceive - toPay,
    },
    today: {
      date: today,
      spent: get(day, 'expense'),
      received: get(day, 'income') + get(day, 'repay_received'),
      count: scoped(kindRows, 'day').reduce((n, r) => n + r.count, 0),
    },
    monthly: {
      income: monthIncome,
      expense: monthExpense,
      received: monthIncome + get(month, 'repay_received'),
      lent: get(month, 'lent'),
      borrowed: get(month, 'borrowed'),
      saved: get(month, 'saving_in') - get(month, 'saving_out'),
      net: monthIncome - monthExpense,
      savingsRate: monthIncome > 0 ? (monthIncome - monthExpense) / monthIncome : 0,
    },
    byCategory: byCategory.map((c) => ({
      name: c.name || 'Uncategorised',
      total: c.total,
      count: c.count,
      share: monthExpense > 0 ? c.total / monthExpense : 0,
      budget: settings.budgets?.[c.name] ?? 0,
    })),
    bySource: bySource.map((s) => ({ name: s.name || 'Other', total: s.total, count: s.count })),
    wallets,
    walletTotal,
    trend,
    recent: recentRows.map(Transaction.toJSON),
  });
}));

/* Just the wallet balances. The add form asks for these to check an entry
   against the wallet paying for it, and loading the whole dashboard to get four
   numbers would make opening the form noticeably slower.

   `exclude` drops one entry from the sums — the one being edited, so its own
   old amount is not counted against its new one. */
router.get('/wallets', wrap(async (req, res) => {
  const exclude = req.query.exclude || null;
  const [settingsRow, movement, transferIn] = await Promise.all([
    Settings.load(req.userId),
    Transaction.walletMovement(req.userId, exclude),
    Transaction.walletTransferIn(req.userId, exclude),
  ]);

  const settings = Settings.toJSON(settingsRow);
  const balances = balancesFrom({ openings: openingsFor(settings), movement, transferIn });
  const names = [...new Set([...(settings.methods || []), ...Object.keys(balances)])];

  res.json({
    currency: settings.currency,
    wallets: names.map((name) => ({ name, balance: balances[name] || 0 })),
  });
}));

/* Per-day totals for the month, for the calendar sheet. Kept separate from the
   dashboard payload so opening the calendar never refetches the whole summary. */
router.get('/calendar', wrap(async (req, res) => {
  const { start, end, key } = monthRange(req.query.month);
  const rows = await Transaction.byDay(req.userId, dayKey(start), dayKey(end));

  const days = {};
  for (const r of rows) {
    const d = (days[r.day] ||= { day: r.day, spent: 0, received: 0, count: 0 });
    const dir = dirOf(r.kind);
    d.count += r.count;
    if (r.kind === 'expense') d.spent += r.total;
    else if (dir > 0 && r.kind !== 'transfer') d.received += r.total;
  }

  const list = Object.values(days).sort((a, b) => a.day.localeCompare(b.day));
  const busiest = list.reduce((best, d) => (!best || d.spent > best.spent ? d : best), null);

  res.json({
    month: key,
    days: list,
    maxSpent: list.reduce((n, d) => Math.max(n, d.spent), 0),
    totalSpent: list.reduce((n, d) => n + d.spent, 0),
    totalReceived: list.reduce((n, d) => n + d.received, 0),
    activeDays: list.filter((d) => d.count > 0).length,
    busiest: busiest && busiest.spent > 0 ? busiest : null,
  });
}));

/* Per-month totals across one year, for the calendar's year view. */
router.get('/year', wrap(async (req, res) => {
  const year = Number(req.query.year) || new Date().getUTCFullYear();
  const rows = await Transaction.byMonth(req.userId, `${year}-01-01`, `${year + 1}-01-01`);

  const map = {};
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    map[key] = { month: key, spent: 0, received: 0, count: 0 };
  }
  for (const r of rows) {
    const m = map[r.month];
    if (!m) continue;
    m.count += r.count;
    if (r.kind === 'expense') m.spent += r.total;
    else if (dirOf(r.kind) > 0 && r.kind !== 'transfer') m.received += r.total;
  }

  const months = Object.values(map);
  res.json({
    year,
    months,
    maxSpent: months.reduce((n, m) => Math.max(n, m.spent), 0),
    totalSpent: months.reduce((n, m) => n + m.spent, 0),
    totalReceived: months.reduce((n, m) => n + m.received, 0),
  });
}));

export default router;
