import { Router } from 'express';
import mongoose from 'mongoose';
import Goal from '../models/Goal.js';
import Transaction from '../models/Transaction.js';
import { wrap } from '../lib/async.js';

const router = Router();

router.get('/', wrap(async (req, res) => {
  const [goals, sums] = await Promise.all([
    Goal.find({ user: req.userId, archived: false }).sort({ createdAt: 1 }).lean(),
    Transaction.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(req.userId), kind: { $in: ['saving_in', 'saving_out'] } } },
      { $group: { _id: { goal: '$goal', kind: '$kind' }, total: { $sum: '$amount' } } },
    ]),
  ]);

  const saved = {};
  let unassigned = 0;
  for (const s of sums) {
    const sign = s._id.kind === 'saving_in' ? 1 : -1;
    if (!s._id.goal) { unassigned += sign * s.total; continue; }
    saved[String(s._id.goal)] = (saved[String(s._id.goal)] || 0) + sign * s.total;
  }

  const items = goals.map((g) => {
    const amount = saved[String(g._id)] || 0;
    return { ...g, saved: amount, progress: g.target > 0 ? Math.min(1, amount / g.target) : 0 };
  });

  res.json({
    items,
    unassigned,
    totalSaved: items.reduce((n, g) => n + g.saved, 0) + unassigned,
    totalTarget: items.reduce((n, g) => n + (g.target || 0), 0),
  });
}));

router.post('/', wrap(async (req, res) => {
  const goal = await Goal.create({
    user: req.userId,
    name: String(req.body.name || '').trim(),
    target: Number(req.body.target) || 0,
    color: req.body.color || '#2f9e6f',
  });
  res.status(201).json(goal);
}));

router.put('/:id', wrap(async (req, res) => {
  const goal = await Goal.findOneAndUpdate({ _id: req.params.id, user: req.userId }, {
    ...(req.body.name !== undefined && { name: String(req.body.name).trim() }),
    ...(req.body.target !== undefined && { target: Number(req.body.target) || 0 }),
    ...(req.body.color !== undefined && { color: req.body.color }),
    ...(req.body.archived !== undefined && { archived: !!req.body.archived }),
  }, { new: true });
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  res.json(goal);
}));

// Deleting a goal keeps its transactions — they fall back to unassigned savings.
router.delete('/:id', wrap(async (req, res) => {
  const gone = await Goal.findOneAndDelete({ _id: req.params.id, user: req.userId });
  if (!gone) return res.status(404).json({ error: 'Goal not found' });
  await Transaction.updateMany({ goal: req.params.id, user: req.userId }, { $set: { goal: null } });
  res.json({ ok: true, id: req.params.id });
}));

export default router;
