import { Router } from 'express';
import * as User from '../models/User.js';
import { build } from '../lib/statement.js';
import { buildWorkbook } from '../lib/export-xlsx.js';
import { buildPdf } from '../lib/export-pdf.js';
import { wrap } from '../lib/async.js';

const router = Router();
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

/* One window, however it was asked for: a pair of dates, or a month, or
   nothing at all — which means everything ever logged. */
export function windowFrom(q) {
  if (MONTH.test(String(q.month || ''))) {
    const [y, m] = q.month.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${q.month}-01`, to: `${q.month}-${String(last).padStart(2, '0')}` };
  }
  return {
    from: DAY.test(String(q.from || '')) ? q.from : null,
    to: DAY.test(String(q.to || '')) ? q.to : null,
  };
}

const named = (st, ext) => {
  const scope = st.scope === 'All wallets' ? 'all' : String(st.scope).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const span = st.from && st.to ? `${st.from}_${st.to}` : new Date().toISOString().slice(0, 10);
  return `hisab-statement-${scope}-${span}.${ext}`;
};

// Everything downloadable answers the same question, so they share one loader.
async function statementFor(req) {
  const { from, to } = windowFrom(req.query);
  const method = String(req.query.method || '').trim();
  return build(req.userId, { from, to, method: method && method !== 'all' ? method : '' });
}

/* Plain CSV so the data can always go back into a spreadsheet. Unfiltered by
   default, which is what it always did — the parameters are additions. */
router.get('/csv', wrap(async (req, res) => {
  const st = await statementFor(req);
  const header = ['Date', 'Description', 'Type', 'Category', 'Person', 'Wallet', 'Paid out', 'Paid in', 'Balance', 'Split'];
  const rows = st.entries.map((e) => [
    e.date, e.description, e.kind, e.category, e.person, e.wallet,
    e.paidOut ?? '', e.paidIn ?? '', e.balance, e.split,
  ].map(esc).join(','));

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${named(st, 'csv')}"`);
  res.send([header.join(','), ...rows].join('\n'));
}));

router.get('/xlsx', wrap(async (req, res) => {
  const [st, user] = await Promise.all([statementFor(req), User.findById(req.userId)]);
  const buffer = await buildWorkbook(st, { name: user?.name || '' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${named(st, 'xlsx')}"`);
  res.send(Buffer.from(buffer));
}));

router.get('/pdf', wrap(async (req, res) => {
  const [st, user] = await Promise.all([statementFor(req), User.findById(req.userId)]);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${named(st, 'pdf')}"`);
  // Streamed rather than buffered: a long statement should not sit in memory
  // twice on a small instance.
  buildPdf(st, { name: user?.name || '', email: user?.email || '' }).pipe(res);
}));

export default router;
