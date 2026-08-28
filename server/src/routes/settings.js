import { Router } from 'express';
import * as Settings from '../models/Settings.js';
import { wrap } from '../lib/async.js';

const router = Router();

router.get('/', wrap(async (req, res) => {
  res.json(Settings.toJSON(await Settings.load(req.userId)));
}));

router.put('/', wrap(async (req, res) => {
  await Settings.load(req.userId);           // make sure there is a row to update
  const list = (v) => [...new Set(v.map((x) => String(x).trim()).filter(Boolean))];
  const patch = {};

  if (req.body.currency !== undefined) patch.currency = String(req.body.currency).trim() || '₹';
  if (Array.isArray(req.body.categories)) patch.categories = list(req.body.categories);
  if (Array.isArray(req.body.sources)) patch.sources = list(req.body.sources);
  if (Array.isArray(req.body.methods)) patch.methods = list(req.body.methods);
  if (req.body.budgets && typeof req.body.budgets === 'object') {
    patch.budgets = Object.fromEntries(Object.entries(req.body.budgets).map(([k, v]) => [k, Number(v) || 0]));
  }
  if (req.body.openingBalances && typeof req.body.openingBalances === 'object') {
    const entries = Object.entries(req.body.openingBalances).map(([k, v]) => [k, Number(v) || 0]);
    patch.openingBalances = Object.fromEntries(entries);
    // Keep the headline opening figure equal to the wallets, so the balance card
    // and the wallet list can never disagree.
    patch.openingBalance = entries.reduce((n, [, v]) => n + v, 0);
  } else if (req.body.openingBalance !== undefined) {
    patch.openingBalance = Number(req.body.openingBalance) || 0;
  }

  res.json(Settings.toJSON(await Settings.save(req.userId, patch)));
}));

export default router;
