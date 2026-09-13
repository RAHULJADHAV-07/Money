import * as Transaction from '../models/Transaction.js';
import * as Settings from '../models/Settings.js';
import { KINDS, dirOf } from './kinds.js';
import { openingsFor } from './wallets.js';

/*
 * One statement, however it is going to be printed.
 *
 * The CSV, the spreadsheet and the PDF all ask for the same thing — a window of
 * entries, in the order they happened, with a balance carried down the side —
 * so it is worked out once here and handed to whichever writer was asked for.
 *
 * A running balance is the whole reason this is not just a list. It is what
 * makes a statement checkable against the bank's own, and it only works if the
 * opening figure and the per-row effect agree, which is what `effectOn` below
 * is for.
 */

/** What one entry does to the scope being reported on. */
export function effectOn(t, wallet) {
  /* A transfer is the one kind whose effect depends on where you are standing.
     Across the whole account it nets to nothing — the money never left. Inside
     a single wallet it is a withdrawal from one side and a deposit on the
     other, and a statement for that wallet has to show it. */
  if (t.kind === 'transfer') {
    if (!wallet) return 0;
    if (t.method === wallet) return -t.amount;
    if (t.to_method === wallet) return t.amount;
    return 0;
  }
  return dirOf(t.kind) * t.amount;
}

/** What a row is called on the statement, in the words of the thing that happened. */
export function describe(t) {
  if (t.note) return t.note;
  if (t.person) return `${KINDS[t.kind]?.label || t.kind} — ${t.person}`;
  if (t.category) return t.category;
  if (t.source) return t.source;
  if (t.goal_name) return t.goal_name;
  return KINDS[t.kind]?.label || t.kind;
}

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * `filters` is { from, to, method } — method being a single wallet, or empty
 * for every wallet at once.
 */
export async function build(userId, { from, to, method }) {
  const wallet = method || null;
  const window = { ...(from && { from }), ...(to && { to }), ...(wallet && { method: wallet }) };

  const [settingsRow, rows, earlier] = await Promise.all([
    Settings.load(userId),
    Transaction.forStatement(userId, window),
    /* Everything before the window, to know what the balance already was. A
       statement that starts from zero every time is not a statement. */
    from ? Transaction.effectsBefore(userId, { from, ...(wallet && { method: wallet }) }) : Promise.resolve([]),
  ]);

  const settings = Settings.toJSON(settingsRow);
  const openings = openingsFor(settings);
  const startedWith = wallet
    ? Number(openings[wallet]) || 0
    : Object.values(openings).reduce((n, v) => n + (Number(v) || 0), 0);

  const opening = money(earlier.reduce((n, t) => n + effectOn(t, wallet), startedWith));

  let running = opening;
  let paidIn = 0;
  let paidOut = 0;
  const entries = rows.map((t) => {
    const effect = effectOn(t, wallet);
    running = money(running + effect);
    if (effect > 0) paidIn += effect;
    if (effect < 0) paidOut -= effect;
    return {
      date: String(t.date).slice(0, 10),
      description: describe(t),
      kind: KINDS[t.kind]?.label || t.kind,
      wallet: t.kind === 'transfer' && t.to_method ? `${t.method} → ${t.to_method}` : t.method,
      category: t.category || t.source || t.goal_name || '',
      person: t.person || '',
      /* Split into two columns the way a statement does, so the eye can add up
         one side without reading signs. Anything that moved no money — a debt
         waived, a transfer seen from outside — lands in neither. */
      paidOut: effect < 0 ? money(-effect) : null,
      paidIn: effect > 0 ? money(effect) : null,
      balance: running,
      split: t.group_id ? (t.group_title || 'Split') : '',
    };
  });

  return {
    entries,
    currency: settings.currency || '₹',
    scope: wallet || 'All wallets',
    from: from || (entries[0]?.date ?? null),
    to: to || (entries.at(-1)?.date ?? null),
    opening,
    closing: money(running),
    paidIn: money(paidIn),
    paidOut: money(paidOut),
  };
}
