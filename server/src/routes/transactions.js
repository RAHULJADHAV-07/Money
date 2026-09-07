import { Router } from 'express';
import * as Transaction from '../models/Transaction.js';
import * as TxGroup from '../models/TxGroup.js';
import * as Goal from '../models/Goal.js';
import * as Settings from '../models/Settings.js';
import { KINDS, KIND_LIST } from '../lib/kinds.js';
import { NEAR_ZERO, paise, reconcile, drains } from '../lib/split.js';
import { openingsFor, balancesFrom, walletSpend } from '../lib/wallets.js';
import { toDayKey, dayKey, monthRange } from '../lib/dates.js';
import { wrap } from '../lib/async.js';

const router = Router();

const bad = (message, extra = {}) => Object.assign(new Error(message), { status: 400, ...extra });

/* The parts of an entry that every kind shares. Split out from `clean` so a
   split's parts are shaped by exactly the same rules as a standalone entry --
   they are stored as standalone entries, after all. */
function fields(body) {
  const kind = String(body.kind || '').trim();
  if (!KINDS[kind]) throw bad(`Unknown kind "${kind}"`);

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) throw bad('Amount must be a number greater than 0');

  const doc = {
    kind,
    amount: paise(amount),
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
    if (!doc.person) throw bad('A name is required for borrowed/lent entries');
  }
  if (needs === 'transfer') {
    doc.toMethod = String(body.toMethod || '').trim();
    if (!doc.toMethod) throw bad('Choose where the money is going');
    if (doc.toMethod === doc.method) throw bad('A transfer needs two different wallets');
  }
  return doc;
}

function clean(body) {
  return { ...fields(body), date: toDayKey(body.date) };
}

/*
 * A split entry.
 *
 * You say what really changed hands, then break it into parts until nothing is
 * left over. The refusal below is the whole feature: an entry the app cannot
 * fully explain is not saved, so a leftover ten rupees can never quietly land
 * on the wrong side of someone's debt.
 */
function cleanGroup(body) {
  const date = toDayKey(body.date);
  const raw = Array.isArray(body.parts) ? body.parts : [];
  if (raw.length < 2) throw bad('A split needs at least two parts — with one, add it as an ordinary entry');
  if (raw.length > 20) throw bad('A split can hold at most 20 parts');

  const parts = raw.map((p) => {
    const doc = fields(p);
    // A transfer is your own money moving between your own wallets; it has no
    // place in an event shared with someone else, and it would need a second
    // wallet that the reconciliation below has no side for.
    if (doc.kind === 'transfer') throw bad('A transfer cannot be part of a split — add it as its own entry');
    return { ...doc, date };
  });

  const received = paise(Number(body.received) || 0);
  const paid = paise(Number(body.paid) || 0);
  if (received <= 0 && paid <= 0) throw bad('Say how much money came in, or how much went out');

  const sum = reconcile(parts, received, paid);
  const off = (side, verb, tally, declared, left) =>
    bad(
      `The parts ${side} add up to ${tally}, but you ${verb} ${declared} — ` +
      `${paise(Math.abs(left))} is ${left > 0 ? 'unaccounted for' : 'over'}.`,
      { code: 'SPLIT_UNBALANCED' }
    );
  if (Math.abs(sum.inLeft) > NEAR_ZERO) throw off('coming in', 'received', sum.in, received, sum.inLeft);
  if (Math.abs(sum.outLeft) > NEAR_ZERO) throw off('going out', 'paid', sum.out, paid, sum.outLeft);

  /* Kept verbatim so reopening a split shows the answers you gave. It is never
     read back for any total -- the parts above are the only truth -- so it is
     checked for shape and size and otherwise left alone. */
  const form = body.form && typeof body.form === 'object' && !Array.isArray(body.form) ? body.form : {};
  if (JSON.stringify(form).length > 4000) throw bad('That split carries too much detail to store');

  return {
    date,
    title: String(body.title || '').trim(),
    note: String(body.note || '').trim(),
    received,
    paid,
    // The event's own headline, which need not equal either side of the ledger.
    total: paise(Number(body.total) || Math.max(received, paid)),
    form,
    parts,
  };
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
    throw bad('That savings bucket does not exist');
  }
}

/*
 * You cannot spend from a wallet what it does not hold.
 *
 * The wallet balance is the one shown on the dashboard, so a refusal here always
 * matches what the app is displaying. Editing an entry measures against the
 * wallet with that entry taken back out, or raising an amount would be compared
 * against a balance that still included the old one.
 *
 * The message names the way out: an empty wallet usually means the opening
 * balance was never set, not that there is genuinely no money.
 */
async function walletBalances(userId, { excludeId = null, excludeGroupId = null } = {}) {
  const [settings, movement, transferIn] = await Promise.all([
    Settings.load(userId),
    Transaction.walletMovement(userId, excludeId, excludeGroupId),
    Transaction.walletTransferIn(userId, excludeId),
  ]);
  const json = Settings.toJSON(settings);
  return {
    currency: settings.currency || '',
    balances: balancesFrom({ openings: openingsFor(json), movement, transferIn }),
  };
}

function shortfall(wallet, available, needed, currency) {
  const money = (n) => `${currency}${paise(n)}`;
  const detail = available <= NEAR_ZERO ? `${wallet} is empty.` : `${wallet} only has ${money(available)}.`;
  return Object.assign(
    new Error(
      `${detail} This entry needs ${money(needed)}. ` +
      `Pick another wallet, or if ${wallet} already held money before you started logging here, ` +
      `set its opening balance in Settings → Wallets.`
    ),
    { status: 400, code: 'INSUFFICIENT_FUNDS', wallet, available, needed }
  );
}

async function assertWalletCovers(userId, doc, excludeId = null) {
  const spend = walletSpend(doc);
  if (spend <= 0) return;

  const { currency, balances } = await walletBalances(userId, { excludeId });
  const wallet = doc.method || 'Cash';
  const available = balances[wallet] || 0;
  if (spend <= available + NEAR_ZERO) return;
  throw shortfall(wallet, available, spend, currency);
}

/* The same rule, measured over the whole split rather than part by part --
   see `drains` in lib/split.js for why the netting has to come first. */
async function assertGroupCovers(userId, group, excludeGroupId = null) {
  const short = drains(group.parts);
  if (!short.length) return;

  const { currency, balances } = await walletBalances(userId, { excludeGroupId });
  for (const [wallet, d] of short) {
    const available = balances[wallet] || 0;
    if (-d <= available + NEAR_ZERO) continue;
    throw shortfall(wallet, available, -d, currency);
  }
}

/* ── Splits ────────────────────────────────────────────────────────────────
   Registered before `/:id` so a two-segment path can never be read as an id. */

router.get('/group/:id', wrap(async (req, res) => {
  const group = await TxGroup.findOne(req.params.id, req.userId);
  if (!group) return res.status(404).json({ error: 'Split not found' });
  res.json(group);
}));

router.post('/group', wrap(async (req, res) => {
  const doc = cleanGroup(req.body);
  for (const p of doc.parts) await assertOwnGoal(p.goal, req.userId);
  await assertGroupCovers(req.userId, doc);
  res.status(201).json(await TxGroup.create(req.userId, doc));
}));

router.put('/group/:id', wrap(async (req, res) => {
  const doc = cleanGroup(req.body);
  for (const p of doc.parts) await assertOwnGoal(p.goal, req.userId);
  await assertGroupCovers(req.userId, doc, req.params.id);
  const updated = await TxGroup.update(req.params.id, req.userId, doc);
  if (!updated) return res.status(404).json({ error: 'Split not found' });
  res.json(updated);
}));

router.delete('/group/:id', wrap(async (req, res) => {
  const gone = await TxGroup.remove(req.params.id, req.userId);
  if (!gone) return res.status(404).json({ error: 'Split not found' });
  res.json({ ok: true, id: req.params.id });
}));

/* ── Single entries ────────────────────────────────────────────────────────
   A part cannot be edited or deleted on its own: its amount is half of an
   arithmetic the split as a whole has to satisfy, and changing it here would
   leave a saved split that no longer adds up to what it says changed hands. */
async function assertNotPartOfSplit(id, userId) {
  const row = await Transaction.findOne(id, userId);
  if (row?.group_id) {
    throw bad('This entry is part of a split — open the split to change it.', { code: 'PART_OF_SPLIT', group: row.group_id });
  }
}

router.post('/', wrap(async (req, res) => {
  const doc = clean(req.body);
  await assertOwnGoal(doc.goal, req.userId);
  await assertWalletCovers(req.userId, doc);
  res.status(201).json(Transaction.toJSON(await Transaction.create(req.userId, doc)));
}));

router.put('/:id', wrap(async (req, res) => {
  await assertNotPartOfSplit(req.params.id, req.userId);
  const doc = clean(req.body);
  await assertOwnGoal(doc.goal, req.userId);
  await assertWalletCovers(req.userId, doc, req.params.id);
  const updated = await Transaction.update(req.params.id, req.userId, doc);
  if (!updated) return res.status(404).json({ error: 'Transaction not found' });
  res.json(Transaction.toJSON(updated));
}));

router.delete('/:id', wrap(async (req, res) => {
  await assertNotPartOfSplit(req.params.id, req.userId);
  const gone = await Transaction.remove(req.params.id, req.userId);
  if (!gone) return res.status(404).json({ error: 'Transaction not found' });
  res.json({ ok: true, id: req.params.id });
}));

export default router;
