import { Router } from 'express';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import { wrap } from '../lib/async.js';

const router = Router();
const DEBT_KINDS = ['lent', 'borrowed', 'repay_received', 'repay_paid'];

// One row per person: what they still owe you, or you still owe them.
router.get('/', wrap(async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.userId);
  const rows = await Transaction.aggregate([
    { $match: { user: userId, kind: { $in: DEBT_KINDS }, person: { $ne: '' } } },
    {
      $group: {
        _id: { person: '$person', kind: '$kind' },
        total: { $sum: '$amount' },
        last: { $max: '$date' },
        count: { $sum: 1 },
      },
    },
  ]);

  const map = {};
  for (const r of rows) {
    const p = (map[r._id.person] ||= {
      person: r._id.person, lent: 0, borrowed: 0, repay_received: 0, repay_paid: 0,
      entries: 0, lastActivity: null,
    });
    p[r._id.kind] = r.total;
    p.entries += r.count;
    if (!p.lastActivity || r.last > p.lastActivity) p.lastActivity = r.last;
  }

  const people = Object.values(map).map((p) => {
    const theyOweMe = p.lent - p.repay_received;
    const iOweThem = p.borrowed - p.repay_paid;
    const net = theyOweMe - iOweThem;           // positive = money is coming back to you
    return {
      ...p,
      theyOweMe: Math.max(0, theyOweMe),
      iOweThem: Math.max(0, iOweThem),
      net,
      settled: Math.abs(net) < 0.01,
    };
  });

  people.sort((a, b) => (a.settled - b.settled) || Math.abs(b.net) - Math.abs(a.net));
  res.json({
    people,
    totals: {
      toReceive: people.reduce((n, p) => n + p.theyOweMe, 0),
      toPay: people.reduce((n, p) => n + p.iOweThem, 0),
    },
  });
}));

// Full history for one person, for the detail sheet.
router.get('/:person', wrap(async (req, res) => {
  const items = await Transaction.find({ user: req.userId, person: req.params.person, kind: { $in: DEBT_KINDS } })
    .sort({ date: -1, createdAt: -1 }).lean();
  res.json({ person: req.params.person, items });
}));

export default router;
