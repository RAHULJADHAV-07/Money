import { Router } from 'express';
import * as Settings from '../models/Settings.js';
import { wrap } from '../lib/async.js';

const router = Router();

router.get('/', wrap(async (req, res) => {
  res.json(Settings.toJSON(await Settings.load(req.userId)));
}));

router.put('/', wrap(async (req, res) => {
  const current = await Settings.load(req.userId);   // make sure there is a row to update
  const list = (v) => [...new Set(v.map((x) => String(x).trim()).filter(Boolean))];
  const patch = {};
  /* Credit cards are written through /api/cards and nowhere else — their terms
     and their opening outstanding are one thing, saved together. So this route
     never changes either: a card's opening balance is carried over as it is,
     whatever arrives, and a limit can never be typed into a wallet's opening
     balance by way of the general settings form. */
  const cards = current.credit_cards || {};

  if (req.body.currency !== undefined) patch.currency = String(req.body.currency).trim() || '₹';
  if (Array.isArray(req.body.categories)) patch.categories = list(req.body.categories);
  if (Array.isArray(req.body.sources)) patch.sources = list(req.body.sources);
  if (Array.isArray(req.body.methods)) patch.methods = list(req.body.methods);
  if (req.body.budgets && typeof req.body.budgets === 'object') {
    patch.budgets = Object.fromEntries(Object.entries(req.body.budgets).map(([k, v]) => [k, Number(v) || 0]));
  }
  if (req.body.openingBalances && typeof req.body.openingBalances === 'object') {
    const openings = Object.fromEntries(
      Object.entries(req.body.openingBalances).filter(([k]) => !cards[k]).map(([k, v]) => [k, Number(v) || 0])
    );
    for (const name of Object.keys(cards)) {
      if (current.opening_balances?.[name] !== undefined) openings[name] = Number(current.opening_balances[name]) || 0;
    }
    patch.openingBalances = openings;
    // Keep the headline opening figure equal to the wallets, so the balance card
    // and the wallet list can never disagree.
    patch.openingBalance = Object.values(openings).reduce((n, v) => n + v, 0);
  } else if (req.body.openingBalance !== undefined) {
    patch.openingBalance = Number(req.body.openingBalance) || 0;
  }

  // Removing a wallet that was a card takes its card terms with it.
  if (patch.methods) {
    patch.creditCards = Object.fromEntries(Object.entries(cards).filter(([name]) => patch.methods.includes(name)));
  }

  res.json(Settings.toJSON(await Settings.save(req.userId, patch)));
}));

export default router;
