import { Router } from 'express';
import * as Settings from '../models/Settings.js';
import { wrap } from '../lib/async.js';
import { cleanCard } from '../lib/credit.js';

const router = Router();

router.get('/', wrap(async (req, res) => {
  res.json(Settings.toJSON(await Settings.load(req.userId)));
}));

router.put('/', wrap(async (req, res) => {
  const current = await Settings.load(req.userId);   // make sure there is a row to update
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

  /* Only wallets that exist can be cards, and every number is made usable on
     the way in — a statement day of 40 or a negative limit would otherwise
     sit in the row and break every bill worked out from it. Removing a wallet
     drops its card terms with it. */
  const methods = patch.methods || current.methods || [];
  const incoming = req.body.creditCards && typeof req.body.creditCards === 'object' && !Array.isArray(req.body.creditCards)
    ? req.body.creditCards
    : (patch.methods ? current.credit_cards || {} : null);
  if (incoming) {
    patch.creditCards = Object.fromEntries(
      Object.entries(incoming).filter(([name]) => methods.includes(name)).map(([name, c]) => [name, cleanCard(c)])
    );
  }

  res.json(Settings.toJSON(await Settings.save(req.userId, patch)));
}));

export default router;
