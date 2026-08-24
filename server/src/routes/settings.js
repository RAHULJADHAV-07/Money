import { Router } from 'express';
import Settings from '../models/Settings.js';
import { wrap } from '../lib/async.js';

const router = Router();

router.get('/', wrap(async (req, res) => res.json(await Settings.load(req.userId))));

router.put('/', wrap(async (req, res) => {
  const s = await Settings.load(req.userId);
  const list = (v) => [...new Set(v.map((x) => String(x).trim()).filter(Boolean))];

  if (req.body.currency !== undefined) s.currency = String(req.body.currency).trim() || '₹';
  if (req.body.openingBalance !== undefined) s.openingBalance = Number(req.body.openingBalance) || 0;
  if (Array.isArray(req.body.categories)) s.categories = list(req.body.categories);
  if (Array.isArray(req.body.sources)) s.sources = list(req.body.sources);
  if (Array.isArray(req.body.methods)) s.methods = list(req.body.methods);
  if (req.body.budgets && typeof req.body.budgets === 'object') {
    s.budgets = new Map(Object.entries(req.body.budgets).map(([k, v]) => [k, Number(v) || 0]));
  }
  await s.save();
  res.json(s);
}));

export default router;
