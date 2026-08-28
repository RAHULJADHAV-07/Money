import { Router } from 'express';
import * as Transaction from '../models/Transaction.js';
import { wrap } from '../lib/async.js';

const router = Router();
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// Plain CSV so the data can always go back into a spreadsheet.
router.get('/csv', wrap(async (req, res) => {
  const items = await Transaction.allForExport(req.userId);
  const header = ['Date', 'Kind', 'Amount', 'Category', 'Source', 'Person', 'Goal', 'Method', 'Note'];
  const rows = items.map((t) => [
    t.date,
    t.kind, t.amount, t.category, t.source, t.person, t.goal_name || '', t.method, t.note,
  ].map(esc).join(','));

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="hisab-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send([header.join(','), ...rows].join('\n'));
}));

export default router;
