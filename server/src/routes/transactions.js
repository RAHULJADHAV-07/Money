import { Router } from 'express';
import Transaction from '../models/Transaction.js';
import Goal from '../models/Goal.js';
import { KINDS, KIND_LIST } from '../lib/kinds.js';
import { toDayUTC, monthRange } from '../lib/dates.js';
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
    date: toDayUTC(body.date),
    note: String(body.note || '').trim(),
    method: String(body.method || 'Cash').trim(),
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
  return doc;
}

router.get('/', wrap(async (req, res) => {
  const { month, from, to, kind, kinds, person, category, q } = req.query;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const skip = Number(req.query.skip) || 0;
  const filter = { user: req.userId };

  if (month) {
    const { start, end } = monthRange(month);
    filter.date = { $gte: start, $lt: end };
  } else if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = toDayUTC(from);
    if (to) filter.date.$lte = toDayUTC(to);
  }

  if (kind) filter.kind = kind;
  if (kinds) filter.kind = { $in: String(kinds).split(',').filter((k) => KIND_LIST.includes(k)) };
  if (person) filter.person = person;
  if (category) filter.category = category;
  if (q) filter.$or = [
    { note: new RegExp(q, 'i') }, { person: new RegExp(q, 'i') },
    { category: new RegExp(q, 'i') }, { source: new RegExp(q, 'i') },
  ];

  const [items, total] = await Promise.all([
    Transaction.find(filter).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit).populate('goal', 'name color').lean(),
    Transaction.countDocuments(filter),
  ]);
  res.json({ items, total, hasMore: skip + items.length < total });
}));

// A goal id from the client must belong to the caller, or it could skew someone else's totals.
async function assertOwnGoal(goalId, userId) {
  if (!goalId) return;
  const owned = await Goal.exists({ _id: goalId, user: userId });
  if (!owned) throw Object.assign(new Error('That savings bucket does not exist'), { status: 400 });
}

router.post('/', wrap(async (req, res) => {
  const doc = clean(req.body);
  await assertOwnGoal(doc.goal, req.userId);
  const created = await Transaction.create({ ...doc, user: req.userId });
  res.status(201).json(await created.populate('goal', 'name color'));
}));

router.put('/:id', wrap(async (req, res) => {
  const doc = clean(req.body);
  await assertOwnGoal(doc.goal, req.userId);
  const updated = await Transaction.findOneAndUpdate({ _id: req.params.id, user: req.userId }, doc, {
    new: true, runValidators: true,
  }).populate('goal', 'name color');
  if (!updated) return res.status(404).json({ error: 'Transaction not found' });
  res.json(updated);
}));

router.delete('/:id', wrap(async (req, res) => {
  const gone = await Transaction.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!gone) return res.status(404).json({ error: 'Transaction not found' });
  res.json({ ok: true, id: req.params.id });
}));

export default router;
