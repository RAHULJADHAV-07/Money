import { Router } from 'express';
import * as Transaction from '../models/Transaction.js';
import { wrap } from '../lib/async.js';

const router = Router();
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// Plain CSV so the data can always go back into a spreadsheet.
router.get('/csv', wrap(async (req, res) => {
  const items = await Transaction.allForExport(req.userId);
  // Parts of a split export as ordinary rows -- which is what they are -- with
  // the split named alongside, so the ones that belong together stay legible.
  const header = ['Date', 'Kind', 'Amount', 'Category', 'Source', 'Person', 'Goal', 'Method', 'Note', 'Split'];
  const rows = items.map((t) => [
    t.date,
    t.kind, t.amount, t.category, t.source, t.person, t.goal_name || '', t.method, t.note,
    t.group_id ? (t.group_title || 'Split') : '',
  ].map(esc).join(','));

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="hisab-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send([header.join(','), ...rows].join('\n'));
}));

export default router;
