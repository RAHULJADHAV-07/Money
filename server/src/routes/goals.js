import { Router } from 'express';
import * as Goal from '../models/Goal.js';
import { wrap } from '../lib/async.js';

const router = Router();

router.get('/', wrap(async (req, res) => {
  const [goals, sums] = await Promise.all([
    Goal.listActive(req.userId),
    Goal.savedTotals(req.userId),
  ]);

  const saved = {};
  let unassigned = 0;
  for (const s of sums) {
    const sign = s.kind === 'saving_in' ? 1 : -1;
    if (!s.goal_id) { unassigned += sign * s.total; continue; }
    saved[s.goal_id] = (saved[s.goal_id] || 0) + sign * s.total;
  }

  const items = goals.map((g) => {
    const amount = saved[g.id] || 0;
    return { ...Goal.toJSON(g), saved: amount, progress: g.target > 0 ? Math.min(1, amount / g.target) : 0 };
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
    userId: req.userId,
    name: String(req.body.name || '').trim(),
    target: Number(req.body.target) || 0,
    color: req.body.color || '#2f9e6f',
  });
  res.status(201).json(Goal.toJSON(goal));
}));

router.put('/:id', wrap(async (req, res) => {
  const goal = await Goal.update(req.params.id, req.userId, {
    ...(req.body.name !== undefined && { name: String(req.body.name).trim() }),
    ...(req.body.target !== undefined && { target: Number(req.body.target) || 0 }),
    ...(req.body.color !== undefined && { color: req.body.color }),
    ...(req.body.archived !== undefined && { archived: !!req.body.archived }),
  });
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  res.json(Goal.toJSON(goal));
}));

// Deleting a goal keeps its transactions — they fall back to unassigned savings.
router.delete('/:id', wrap(async (req, res) => {
  const gone = await Goal.remove(req.params.id, req.userId);
  if (!gone) return res.status(404).json({ error: 'Goal not found' });
  res.json({ ok: true, id: req.params.id });
}));

export default router;
