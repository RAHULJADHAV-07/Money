import { Router } from 'express';
import * as Transaction from '../models/Transaction.js';
import * as Settings from '../models/Settings.js';
import { tx } from '../db.js';
import { openingsFor } from '../lib/wallets.js';
import { cardsOf, cardReport, cleanCard, cardProblem, cardMove, activity } from '../lib/credit.js';
import { toDayKey, dayKey, startOfToday } from '../lib/dates.js';
import { bad } from '../lib/entry.js';
import { wrap } from '../lib/async.js';

const router = Router();

const todayOf = (req) => (req.query.today ? toDayKey(req.query.today) : dayKey(startOfToday()));
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

async function load(userId) {
  const settings = Settings.toJSON(await Settings.load(userId));
  return { settings, cards: cardsOf(settings), openings: openingsFor(settings) };
}

/*
 * Every credit card, as of `today` — the cycle running now, the last statement,
 * all-time activity, the credit left. `today` comes from the device, like the
 * dashboard's, so a bill falls due on the user's calendar rather than the
 * server's.
 */
router.get('/', wrap(async (req, res) => {
  const today = todayOf(req);
  const { settings, cards, openings } = await load(req.userId);
  const names = Object.keys(cards);
  if (!names.length) return res.json({ currency: settings.currency, today, cards: [] });

  const rows = await Transaction.touching(req.userId, names);
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

/* What happened on one card over any stretch of days — the custom period on
   the card's screen. Purchases, refunds and payments, never the outstanding. */
router.get('/:name/activity', wrap(async (req, res) => {
  const { cards } = await load(req.userId);
  const name = req.params.name;
  if (!cards[name]) return res.status(404).json({ error: 'No credit card by that name' });
  const from = req.query.from ? toDayKey(req.query.from) : null;
  const to = req.query.to ? toDayKey(req.query.to) : null;
  if (from && to && from > to) throw bad('The period ends before it starts');
  const moves = (await Transaction.touching(req.userId, [name])).map((t) => cardMove(t, name)).filter(Boolean);
  res.json(activity(moves, from, to));
}));

/*
 * Adding or editing a card. One write, in one transaction, because a card is
 * spread over three things that must agree: the wallet list, the card terms,
 * and the wallet's opening balance (which is minus the opening outstanding —
 * never the limit). A rename also carries every entry and routine across, so
 * no swipe is ever orphaned under the old name.
 */
async function saveCard(userId, oldName, body) {
  const problem = cardProblem(body);
  if (problem) throw bad(problem);
  const name = String(body.name ?? oldName ?? '').trim();
  if (!name) throw bad('Give the card a name');
  if (name.length > 40) throw bad('Keep the card name under 40 characters');

  const terms = cleanCard(body);
  const outstanding = r2(Math.max(0, Number(body.openingOutstanding) || 0));

  return tx(async (db) => {
    const row = await db.one('select * from settings where user_id = $1 for update', [userId]);
    const methods = [...(row.methods || [])];
    const cards = { ...(row.credit_cards || {}) };
    const openings = { ...(row.opening_balances || {}) };

    if (oldName) {
      if (!cards[oldName]) throw Object.assign(bad('No credit card by that name'), { status: 404 });
      if (name !== oldName) {
        if (methods.includes(name)) throw bad(`There is already a wallet called ${name}`);
        methods[methods.indexOf(oldName)] = name;
        delete cards[oldName];
        delete openings[oldName];
        for (const table of ['transactions', 'routines']) {
          await db.query(`update ${table} set method = $3 where user_id = $1 and method = $2`, [userId, oldName, name]);
          await db.query(`update ${table} set to_method = $3 where user_id = $1 and to_method = $2`, [userId, oldName, name]);
        }
      }
    } else {
      if (cards[name]) throw bad(`${name} is already a credit card`);
      // A wallet by that name becomes the card, entries and all; otherwise it is new.
      if (!methods.includes(name)) methods.push(name);
    }

    cards[name] = terms;
    openings[name] = outstanding ? -outstanding : 0;
    const total = Object.values(openings).reduce((n, v) => n + (Number(v) || 0), 0);
    const saved = await db.one(
      `update settings set methods = $2, credit_cards = $3, opening_balances = $4, opening_balance = $5, updated_at = now()
        where user_id = $1 returning *`,
      [userId, methods, JSON.stringify(cards), JSON.stringify(openings), total]
    );
    return Settings.toJSON(saved);
  });
}

router.post('/', wrap(async (req, res) => {
  res.status(201).json(await saveCard(req.userId, null, req.body || {}));
}));

router.put('/:name', wrap(async (req, res) => {
  res.json(await saveCard(req.userId, req.params.name, req.body || {}));
}));

/* No longer a credit card. The wallet and every entry on it stay; only the
   card terms go, so nothing that happened is lost. */
router.delete('/:name', wrap(async (req, res) => {
  const row = await Settings.load(req.userId);
  const cards = { ...(row.credit_cards || {}) };
  if (!cards[req.params.name]) return res.status(404).json({ error: 'No credit card by that name' });
  delete cards[req.params.name];
  res.json(Settings.toJSON(await Settings.save(req.userId, { creditCards: cards })));
}));

export default router;
