import { Router } from 'express';
import * as Transaction from '../models/Transaction.js';
import { wrap } from '../lib/async.js';
import { debtNet } from '../lib/kinds.js';

const router = Router();

// One row per person: what they still owe you, or you still owe them.
router.get('/', wrap(async (req, res) => {
  const rows = await Transaction.personTotals(req.userId);

  const map = {};
  for (const r of rows) {
    const p = (map[r.person] ||= {
      person: r.person, lent: 0, borrowed: 0,
      repay_received: 0, repay_paid: 0, settle_received: 0, settle_paid: 0,
      entries: 0, lastActivity: null,
    });
    p[r.kind] = r.total;
    p.entries += r.count;
    if (!p.lastActivity || r.last > p.lastActivity) p.lastActivity = r.last;
  }

  const people = Object.values(map).map((p) => {
    const { theyOweMe, iOweThem } = debtNet(p);
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
  const items = await Transaction.personHistory(req.userId, req.params.person);
  res.json({ person: req.params.person, items: items.map(Transaction.toJSON) });
}));

export default router;
