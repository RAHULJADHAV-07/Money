import { Router } from 'express';
import * as Transaction from '../models/Transaction.js';
import * as Goal from '../models/Goal.js';
import { KINDS, KIND_LIST } from '../lib/kinds.js';
import { toDayKey, dayKey, monthRange } from '../lib/dates.js';
import { wrap } from '../lib/async.js';

const router = Router();

function clean(body) {
  const kind = String(body.kind || '').trim();
  if (!KINDS[kind]) throw Object.assign(new Error(`Unknown kind "${kind}"`), { status: 400 });

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw Object.assign(new Error('Amount must be a number greater than 0'), { status: 400 });
  }

  const doc = {
    kind,
    amount: Math.round(amount * 100) / 100,
    date: toDayKey(body.date),
    note: String(body.note || '').trim(),
    method: String(body.method || 'Cash').trim(),
    toMethod: '',
    category: '', source: '', person: '', goal: null,
  };

  // Only the field this kind actually uses is kept, so entries stay unambiguous.
  const needs = KINDS[kind].needs;
  if (needs === 'category') doc.category = String(body.category || 'Misc').trim();
  if (needs === 'source') doc.source = String(body.source || 'Other').trim();
  if (needs === 'goal') doc.goal = body.goal || null;
  if (needs === 'person') {
    doc.person = String(body.person || '').trim();
    if (!doc.person) throw Object.assign(new Error('A name is required for borrowed/lent entries'), { status: 400 });
  }
  if (needs === 'transfer') {
    doc.toMethod = String(body.toMethod || '').trim();
    if (!doc.toMethod) throw Object.assign(new Error('Choose where the money is going'), { status: 400 });
    if (doc.toMethod === doc.method) {
      throw Object.assign(new Error('A transfer needs two different wallets'), { status: 400 });
    }
  }
  return doc;
}

router.get('/', wrap(async (req, res) => {
  const { month, from, to, kind, kinds, person, category, method, q } = req.query;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const skip = Number(req.query.skip) || 0;
  const filters = { kind, person, category, method, q };

  if (month) {
    const range = monthRange(month);
    filters.from = dayKey(range.start);
    filters.before = dayKey(range.end);
  } else {
    if (from) filters.from = toDayKey(from);
    if (to) filters.to = toDayKey(to);
  }
  if (kinds) filters.kinds = String(kinds).split(',').filter((k) => KIND_LIST.includes(k));

  const { items, total } = await Transaction.list(req.userId, filters, { limit, skip });
  res.json({ items: items.map(Transaction.toJSON), total, hasMore: skip + items.length < total });
}));

// A goal id from the client must belong to the caller, or it could skew someone else's totals.
async function assertOwnGoal(goalId, userId) {
  if (!goalId) return;
  if (!(await Goal.ownedBy(goalId, userId))) {
    throw Object.assign(new Error('That savings bucket does not exist'), { status: 400 });
  }
}

router.post('/', wrap(async (req, res) => {
  const doc = clean(req.body);
  await assertOwnGoal(doc.goal, req.userId);
  res.status(201).json(Transaction.toJSON(await Transaction.create(req.userId, doc)));
}));

router.put('/:id', wrap(async (req, res) => {
  const doc = clean(req.body);
  await assertOwnGoal(doc.goal, req.userId);
  const updated = await Transaction.update(req.params.id, req.userId, doc);
  if (!updated) return res.status(404).json({ error: 'Transaction not found' });
  res.json(Transaction.toJSON(updated));
}));

router.delete('/:id', wrap(async (req, res) => {
  const gone = await Transaction.remove(req.params.id, req.userId);
  if (!gone) return res.status(404).json({ error: 'Transaction not found' });
  res.json({ ok: true, id: req.params.id });
}));

export default router;
