import { Router } from 'express';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Settings from '../models/Settings.js';
import { KINDS } from '../lib/kinds.js';
import { monthRange, lastMonths, toDayUTC, startOfToday } from '../lib/dates.js';
import { wrap } from '../lib/async.js';

const router = Router();

const sumBy = (rows) => rows.reduce((acc, r) => ({ ...acc, [r._id]: r.total }), {});
const get = (map, k) => map[k] || 0;

router.get('/', wrap(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.userId);
  const { start, end, key } = monthRange(req.query.month);
  const today = req.query.today ? toDayUTC(req.query.today) : startOfToday();
  const trendKeys = lastMonths(key, 6);
  const trendStart = monthRange(trendKeys[0]).start;

  const [settings, allTime, thisMonth, todayRows, byCategory, bySource, trendRows, byPerson, recent] =
    await Promise.all([
      Settings.load(userId),
      Transaction.aggregate([{ $match: { user: userId } }, { $group: { _id: '$kind', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Transaction.aggregate([
        { $match: { user: userId, date: { $gte: start, $lt: end } } },
        { $group: { _id: '$kind', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        { $match: { user: userId, date: today } },
        { $group: { _id: '$kind', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Transaction.aggregate([
        { $match: { user: userId, date: { $gte: start, $lt: end }, kind: 'expense' } },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      Transaction.aggregate([
        { $match: { user: userId, date: { $gte: start, $lt: end }, kind: 'income' } },
        { $group: { _id: '$source', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      Transaction.aggregate([
        { $match: { user: userId, date: { $gte: trendStart, $lt: end } } },
        {
          $group: {
            _id: { month: { $dateToString: { format: '%Y-%m', date: '$date' } }, kind: '$kind' },
            total: { $sum: '$amount' },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: { user: userId, kind: { $in: ['lent', 'borrowed', 'repay_received', 'repay_paid'] } } },
        { $group: { _id: { person: '$person', kind: '$kind' }, total: { $sum: '$amount' } } },
      ]),
      Transaction.find({ user: userId }).sort({ date: -1, createdAt: -1 }).limit(8).populate('goal', 'name color').lean(),
    ]);

  const all = sumBy(allTime);
  const month = sumBy(thisMonth);
  const day = sumBy(todayRows);

  // Cash in hand: opening balance plus every entry's signed effect.
  const balance = allTime.reduce((n, r) => n + (KINDS[r._id]?.dir ?? 0) * r.total, settings.openingBalance);
  const savings = get(all, 'saving_in') - get(all, 'saving_out');

  // Nets are computed per person first, so one settled friend never masks another's dues.
  const people = {};
  for (const row of byPerson) {
    const p = (people[row._id.person] ||= { person: row._id.person, lent: 0, borrowed: 0, repay_received: 0, repay_paid: 0 });
    p[row._id.kind] = row.total;
  }
  let toReceive = 0, toPay = 0;
  for (const p of Object.values(people)) {
    toReceive += Math.max(0, p.lent - p.repay_received);
    toPay += Math.max(0, p.borrowed - p.repay_paid);
  }

  const trendMap = {};
  for (const r of trendRows) (trendMap[r._id.month] ||= {})[r._id.kind] = r.total;
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
      date: today.toISOString().slice(0, 10),
      spent: get(day, 'expense'),
      received: get(day, 'income') + get(day, 'repay_received'),
      count: todayRows.reduce((n, r) => n + r.count, 0),
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
      name: c._id || 'Uncategorised',
      total: c.total,
      count: c.count,
      share: monthExpense > 0 ? c.total / monthExpense : 0,
      budget: settings.budgets?.get?.(c._id) ?? 0,
    })),
    bySource: bySource.map((s) => ({ name: s._id || 'Other', total: s.total, count: s.count })),
    trend,
    recent,
  });
}));

export default router;
