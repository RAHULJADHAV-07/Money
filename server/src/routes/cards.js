import { Router } from 'express';
import * as Transaction from '../models/Transaction.js';
import * as Settings from '../models/Settings.js';
import { openingsFor } from '../lib/wallets.js';
import { cardsOf, cardReport } from '../lib/credit.js';
import { toDayKey, dayKey, startOfToday } from '../lib/dates.js';
import { wrap } from '../lib/async.js';

const router = Router();

/*
 * Every credit card, with its bill worked out as of `today` -- the statement,
 * the minimum, the due date, what has been paid towards it, the cycle running
 * now and the statements before it. `today` comes from the device, like the
 * dashboard's, so a bill falls due on the user's calendar rather than the
 * server's.
 */
router.get('/', wrap(async (req, res) => {
  const today = req.query.today ? toDayKey(req.query.today) : dayKey(startOfToday());
  const settings = Settings.toJSON(await Settings.load(req.userId));
  const cards = cardsOf(settings);
  const names = Object.keys(cards);
  if (!names.length) return res.json({ currency: settings.currency, today, cards: [] });

  const rows = await Transaction.touching(req.userId, names);
  const openings = openingsFor(settings);
  const order = settings.methods || [];

  res.json({
    currency: settings.currency,
    today,
    cards: names
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
      .map((name) => cardReport(
        name, cards[name],
        rows.filter((t) => t.method === name || t.to_method === name),
        Number(openings[name]) || 0,
        today,
      )),
  });
}));

export default router;
