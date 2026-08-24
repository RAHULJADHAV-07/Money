import { Router } from 'express';
import Transaction from '../models/Transaction.js';
import { wrap } from '../lib/async.js';

const router = Router();
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

// Plain CSV so the data can always go back into a spreadsheet.
router.get('/csv', wrap(async (req, res) => {
  const items = await Transaction.find({ user: req.userId }).sort({ date: 1 }).populate('goal', 'name').lean();
  const header = ['Date', 'Kind', 'Amount', 'Category', 'Source', 'Person', 'Goal', 'Method', 'Note'];
  const rows = items.map((t) => [
    new Date(t.date).toISOString().slice(0, 10),
    t.kind, t.amount, t.category, t.source, t.person, t.goal?.name || '', t.method, t.note,
  ].map(esc).join(','));

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="hisab-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send([header.join(','), ...rows].join('\n'));
}));

export default router;
