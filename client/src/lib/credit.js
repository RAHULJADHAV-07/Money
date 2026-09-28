import { dateShort } from './format.js';

/*
 * Credit cards, on the client: how a card is spoken about, and the few pieces
 * of arithmetic the ledger needs for a period it picks itself. Everything a
 * card *is* — its outstanding, its statements — is worked out by the server
 * (server/src/lib/credit.js) and only worded here, so the home screen, the
 * card's screen and the ledger never describe the same card two ways.
 *
 * The one rule behind every label: a limit is not money, what is owed is not
 * spending, and spending in a period is not what is owed.
 */

/** A new card's form. Only the limit, statement day and renewal are required. */
export const NEW_CARD = {
  name: '', limit: '', statementDay: '', dueDay: '',
  renewal: { kind: 'annual', month: '' },
  openingOutstanding: '', minPct: '', apr: '', color: '', notes: '',
};

export const isCard = (settings, name) => !!settings?.creditCards?.[name];
export const cardNames = (settings) => (settings?.methods || []).filter((m) => isCard(settings, m));
export const moneyWallets = (settings) => (settings?.methods || []).filter((m) => !isCard(settings, m));

/** 1 → 1st, 22 → 22nd — how a day of the month is said on a bill. */
export function ordinal(n) {
  const v = Number(n) || 0;
  const s = v % 100 >= 11 && v % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[v % 10] || 'th');
  return `${v}${s}`;
}

export const monthName = (ym) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

const inDays = (d) => (d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`);

/*
 * The one line the last statement is summed up by, and its tone. Overdue is
 * the only red: a bill that is merely due is a reminder, not an alarm.
 */
export function billLine(st, money) {
  switch (st.status) {
    case 'clear':    return { tone: 'flat', badge: 'Nothing due', text: 'The last statement had nothing to pay' };
    case 'paid':     return { tone: 'in',   badge: 'Paid', text: `Last statement of ${money(st.billed)} paid in full` };
    case 'open':     return { tone: 'save', badge: 'Unpaid', text: `${money(st.remaining)} left on the last statement` };
    case 'min_paid': return {
      tone: st.daysLeft <= 3 ? 'warn' : 'save', badge: 'Minimum paid',
      text: `${money(st.remaining)} left — due ${dateShort(st.dueDate)}, ${inDays(st.daysLeft)}`,
    };
    case 'due':      return {
      tone: st.daysLeft <= 3 ? 'warn' : 'save', badge: st.daysLeft <= 3 ? 'Due soon' : 'Due',
      text: `${money(st.remaining)} due ${dateShort(st.dueDate)} — ${inDays(st.daysLeft)}`,
    };
    case 'carried':  return { tone: 'warn', badge: 'Interest', text: `${money(st.remaining)} carried past ${dateShort(st.dueDate)} — interest is running` };
    case 'overdue':  return { tone: 'out', badge: 'Overdue', text: `${money(st.remaining)} overdue since ${dateShort(st.dueDate)}` };
    default:         return { tone: 'flat', badge: '', text: '' };
  }
}

export const HISTORY_LABEL = {
  paid: ['Paid in full', 'in'],
  min_paid: ['Minimum only', 'warn'],
  part_paid: ['Part paid', 'warn'],
  unpaid: ['Not paid', 'out'],
  clear: ['Nothing due', 'flat'],
};

/** "Renews Sep 2027", "Expires Mar 2028", "Expired Sep 2026" — or a nudge to set it. */
export function renewalLine(r) {
  if (!r) return 'Renewal not set';
  if (r.kind === 'expiry') return `${r.expired ? 'Expired' : 'Expires'} ${monthName(r.next)}`;
  return `Renews every ${new Date(`${r.next}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'long', timeZone: 'UTC' })} · next ${monthName(r.next)}`;
}

/* How much of the limit is in use. Under 30% is what credit scores like to
   see; past 75% the card is close to refusing. */
export function utilTone(u) {
  if (u === null || u === undefined) return 'flat';
  if (u >= 0.75) return 'out';
  if (u >= 0.3) return 'warn';
  return 'in';
}

/* ── Billing cycles, on 'YYYY-MM-DD' keys ─────────────────────────────────
   The same calendar rules as the server, checked against it in
   server/test/credit.test.js: a cycle runs from the day after one statement
   to the next statement date, both days included, and day 31 in a short
   month is its last day. */
const key = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const lastDay = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const onDay = (y, m, day) => key(y, m, Math.min(day, lastDay(y, m)));
const ym = (k) => { const [y, m] = k.split('-').map(Number); return [y, m - 1]; };
const nextDay = (k) => { const t = new Date(`${k}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); };

/** The cycle whose statement is made up in `month` ('YYYY-MM') — that month's bill. */
export function cycleOfMonth(month, statementDay) {
  const [y, m] = ym(month);
  return { start: nextDay(onDay(y, m - 1, statementDay)), end: onDay(y, m, statementDay) };
}

/** The cycle running on `today`: it began the day after the last statement. */
export function currentCycle(today, statementDay) {
  const [y, m] = ym(today);
  const here = onDay(y, m, statementDay);
  return here < today ? cycleOfMonth(key(y, m + 1, 1).slice(0, 7), statementDay) : cycleOfMonth(today.slice(0, 7), statementDay);
}

/*
 * What happened on one card across a list of ledger rows — the same split the
 * server makes. Purchases (and cash withdrawals) raise what is owed; refunds
 * and payments lower it. Spending is purchases less refunds; a payment is
 * never spending.
 */
export function cardActivity(items, card) {
  const a = { purchases: 0, refunds: 0, paid: 0 };
  for (const t of items) {
    if (t.kind === 'transfer') {
      if (t.method === card) a.purchases += t.amount;
      else if (t.toMethod === card) a.paid += t.amount;
      continue;
    }
    if (t.method !== card) continue;
    if (t.kind === 'refund') a.refunds += t.amount;
    else if (DIR[t.kind] < 0) a.purchases += t.amount;
    else if (DIR[t.kind] > 0) a.paid += t.amount;
  }
  return { ...a, spent: a.purchases - a.refunds };
}

const DIR = {
  expense: -1, lent: -1, repay_paid: -1, saving_in: -1,
  income: 1, borrowed: 1, repay_received: 1, saving_out: 1, refund: 1,
};

/*
 * Real money in and out, for the ledger's In/Out bar. A card purchase is not
 * money out — no cash moved; paying the card bill is. A refund into a real
 * wallet is money in; a refund onto a card only lowers what is owed. Moving
 * money between two of your own wallets is neither.
 */
export function cashFlow(items, cards) {
  const f = { in: 0, out: 0 };
  const card = (w) => cards.includes(w);
  for (const t of items) {
    if (t.kind === 'transfer') {
      if (!card(t.method) && card(t.toMethod)) f.out += t.amount;        // paying a card
      else if (card(t.method) && !card(t.toMethod)) f.in += t.amount;    // cash from a card
      continue;
    }
    if (card(t.method)) continue;
    if (t.kind === 'expense') f.out += t.amount;
    else if (t.kind === 'income' || t.kind === 'repay_received' || t.kind === 'refund') f.in += t.amount;
  }
  return f;
}
