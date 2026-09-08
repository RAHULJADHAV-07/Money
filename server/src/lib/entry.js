import * as Transaction from '../models/Transaction.js';
import * as Goal from '../models/Goal.js';
import * as Settings from '../models/Settings.js';
import { KINDS } from './kinds.js';
import { openingsFor, balancesFrom, walletSpend } from './wallets.js';
import { toDayKey } from './dates.js';

/*
 * The rules an entry has to satisfy, wherever it comes from.
 *
 * The add form, a split's parts and a routine all write the same kind of row,
 * so they all have to be shaped and checked the same way. Kept here rather than
 * in one route, so a second way of adding an entry cannot quietly skip the
 * wallet guard the first one enforces.
 */

export const NEAR_ZERO = 0.005;   // amounts are stored to the paisa; ignore float dust
export const paise = (n) => Math.round(n * 100) / 100;
export const bad = (message, extra = {}) => Object.assign(new Error(message), { status: 400, ...extra });

/* Every field an entry can carry, with only the one its kind actually uses kept
   -- so entries stay unambiguous, whichever form filled them in. */
export function entryFields(body) {
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

export const cleanEntry = (body) => ({ ...entryFields(body), date: toDayKey(body.date) });

// A goal id from the client must belong to the caller, or it could skew someone else's totals.
export async function assertOwnGoal(goalId, userId) {
  if (!goalId) return;
  if (!(await Goal.ownedBy(goalId, userId))) throw bad('That savings bucket does not exist');
}

export async function walletBalances(userId, { excludeId = null, excludeGroupId = null } = {}) {
  const [settings, movement, transferIn] = await Promise.all([
    Settings.load(userId),
    Transaction.walletMovement(userId, excludeId, excludeGroupId),
    Transaction.walletTransferIn(userId, excludeId),
  ]);
  return {
    currency: settings.currency || '',
    balances: balancesFrom({ openings: openingsFor(Settings.toJSON(settings)), movement, transferIn }),
  };
}

/* The message names the way out: an empty wallet usually means the opening
   balance was never set, not that there is genuinely no money. */
export function shortfall(wallet, available, needed, currency) {
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

/*
 * You cannot spend from a wallet what it does not hold.
 *
 * The wallet balance is the one shown on the dashboard, so a refusal here always
 * matches what the app is displaying. Editing an entry measures against the
 * wallet with that entry taken back out, or raising an amount would be compared
 * against a balance that still included the old one.
 */
export async function assertWalletCovers(userId, doc, excludeId = null) {
  const spend = walletSpend(doc);
  if (spend <= 0) return;

  const { currency, balances } = await walletBalances(userId, { excludeId });
  const wallet = doc.method || 'Cash';
  const available = balances[wallet] || 0;
  if (spend <= available + NEAR_ZERO) return;
  throw shortfall(wallet, available, spend, currency);
}
