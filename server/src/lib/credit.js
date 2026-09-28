import { dirOf } from './kinds.js';

/*
 * Credit cards.
 *
 * A credit card is a wallet that runs the other way: it starts at zero and goes
 * *below* it as you spend, because what it holds is the bank's money, not
 * yours. Nothing about the ledger changes for that — a swipe is still an
 * expense, paying the bill is still a transfer from Bank into the card — so
 * every total the app already has keeps working. What is new is everything a
 * bank prints on top of that balance, and it is all worked out here from the
 * card's own entries and four numbers you give it:
 *
 *   limit          how far below zero it may go (0 = no limit set)
 *   statementDay   the day of the month the bill is made up
 *   dueDay         the day of the month that bill must be paid by
 *   apr, minPct    the yearly interest, and what share of the bill is the minimum
 *
 * The month runs:  cycle (spend) → statement date → grace period → due date.
 * Pay the whole statement by the due date and no interest is ever charged.
 */

export const CARD_DEFAULTS = { limit: 0, statementDay: 1, dueDay: 20, apr: 42, minPct: 5, minFloor: 200 };

const NEAR_ZERO = 0.005;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const clamp = (n, lo, hi, d) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
};

/** One card's settings, made safe: whatever arrives, the numbers come out usable. */
export function cleanCard(raw = {}) {
  const d = CARD_DEFAULTS;
  return {
    limit: r2(clamp(raw.limit, 0, 1e10, d.limit)),
    statementDay: Math.round(clamp(raw.statementDay, 1, 31, d.statementDay)),
    dueDay: Math.round(clamp(raw.dueDay, 1, 31, d.dueDay)),
    apr: r2(clamp(raw.apr, 0, 100, d.apr)),
    minPct: r2(clamp(raw.minPct, 0, 100, d.minPct)),
    minFloor: r2(clamp(raw.minFloor, 0, 1e9, d.minFloor)),
  };
}

/** The credit cards among the wallets, keyed by wallet name. */
export function cardsOf(settings) {
  const out = {};
  const methods = settings.methods || [];
  for (const [name, raw] of Object.entries(settings.creditCards || {})) {
    if (methods.includes(name)) out[name] = cleanCard(raw);
  }
  return out;
}

/*
 * What a wallet can still pay out. For an ordinary wallet that is what it
 * holds. For a card it is the credit left — the limit less what is owed — and
 * with no limit set, there is nothing to measure against, so it is unbounded.
 */
export function availableIn(name, balances, cards) {
  const balance = balances[name] || 0;
  const card = cards[name];
  if (!card) return balance;
  if (!(card.limit > 0)) return Infinity;
  return card.limit + balance;
}

/* What one entry did to this card. The same rule as a statement's (see
   effectOn in statement.js), kept here so the bill maths needs no database. */
function effectOn(t, card) {
  if (t.kind !== 'transfer') return t.method === card ? dirOf(t.kind) * t.amount : 0;
  if (t.method === card) return -t.amount;
  if (t.to_method === card) return t.amount;
  return 0;
}

/* ── Calendar arithmetic, on 'YYYY-MM-DD' keys ─────────────────────────────── */

const parse = (key) => { const [y, m, d] = key.split('-').map(Number); return { y, m: m - 1, d }; };
const key = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const lastDay = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
// Day 31 in a 30-day month is the 30th, the way every bank reads it.
const onDay = (y, m, day) => key(y, m, Math.min(day, lastDay(y, m)));
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const addDays = (k, n) => { const t = new Date(`${k}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

/** The statement date in the month `k` falls in. */
const statementIn = (k, day) => { const { y, m } = parse(k); return onDay(y, m, day); };

/** The last statement strictly before `today` — the bill currently being paid. */
export function lastStatement(today, day) {
  const here = statementIn(today, day);
  if (here < today) return here;
  const { y, m } = parse(today);
  return onDay(y, m - 1, day);
}

export function nextStatement(after, day) {
  const here = statementIn(after, day);
  if (here > after) return here;
  const { y, m } = parse(after);
  return onDay(y, m + 1, day);
}

const prevStatement = (stmt, day) => { const { y, m } = parse(stmt); return onDay(y, m - 1, day); };

/** The first `dueDay` after the statement date — usually 15–25 days later. */
export function dueAfter(stmt, dueDay) {
  const { y, m } = parse(stmt);
  const same = onDay(y, m, dueDay);
  return same > stmt ? same : onDay(y, m + 1, dueDay);
}

/* ── The bill ──────────────────────────────────────────────────────────────── */

/** The smallest payment that keeps the card in good standing. */
export function minimumDue(billed, card) {
  if (billed <= NEAR_ZERO) return 0;
  return r2(Math.min(billed, Math.max(card.minFloor, (billed * card.minPct) / 100)));
}

/*
 * Everything the bank would print for one card, as of `today`.
 *
 * `rows` are every entry that touched the card (kind, amount, date, method,
 * to_method), oldest first; `opening` is what the wallet held before any of
 * them — negative when you started out already owing on it.
 */
export function cardReport(name, card, rows, opening, today, { history = 6 } = {}) {
  // What each entry did to the card: a swipe takes it down, a payment brings it back.
  const moves = rows.map((t) => ({ date: String(t.date).slice(0, 10), effect: effectOn(t, name) }))
    .filter((x) => Math.abs(x.effect) > NEAR_ZERO);

  const balanceAt = (k) => moves.reduce((n, x) => (x.date <= k ? n + x.effect : n), opening);
  const creditsIn = (from, to) => moves.reduce((n, x) => (x.date > from && x.date <= to && x.effect > 0 ? n + x.effect : n), 0);
  const chargesIn = (from, to) => moves.reduce((n, x) => (x.date > from && x.date <= to && x.effect < 0 ? n - x.effect : n), 0);

  const balance = moves.reduce((n, x) => n + x.effect, opening);
  const owed = r2(Math.max(0, -balance));
  const available = card.limit > 0 ? r2(card.limit + balance) : null;

  const stmt = lastStatement(today, card.statementDay);
  const next = nextStatement(stmt, card.statementDay);

  /* One statement: what was billed, what was the minimum, and what has been
     paid towards it since. Payments count from the day after the statement,
     which is how a bank applies them. */
  const bill = (s) => {
    const billed = r2(Math.max(0, -balanceAt(s)));
    const due = dueAfter(s, card.dueDay);
    const min = minimumDue(billed, card);
    const paid = r2(creditsIn(s, today));
    const paidByDue = r2(creditsIn(s, due < today ? due : today));
    const before = prevStatement(s, card.statementDay);
    return {
      date: s, cycleStart: addDays(before, 1), dueDate: due, billed, minDue: min,
      spent: r2(chargesIn(before, s)),
      paid, paidByDue,
      remaining: r2(Math.max(0, billed - paid)),
      remainingMin: r2(Math.max(0, min - paid)),
    };
  };

  const current = bill(stmt);
  const daysLeft = daysBetween(today, current.dueDate);

  /* Where this bill stands. The order matters: nothing billed beats everything,
     then paid in full, then what the calendar says about the rest. */
  let status;
  if (current.billed <= NEAR_ZERO) status = 'clear';
  else if (current.remaining <= NEAR_ZERO) status = 'paid';
  else if (daysLeft >= 0) status = current.remainingMin <= NEAR_ZERO ? 'min_paid' : 'due';
  else status = current.paidByDue + NEAR_ZERO >= current.minDue ? 'carried' : 'overdue';

  // Interest runs on what is left unpaid once the due date has gone by.
  const monthlyRate = card.apr / 1200;
  const interestIfCarried = r2(current.remaining * monthlyRate);

  /* A purchase today lands on the next statement and is due on that statement's
     due date: that gap is the interest-free period it gets. Bought the day
     after a statement, it gets the longest one. */
  const nextDue = dueAfter(next, card.dueDay);
  const bestDay = addDays(stmt, 1) > today ? addDays(stmt, 1) : addDays(next, 1);

  /* Earlier statements, newest first, only as far back as the card has been
     used here. A statement from before the first entry knows nothing but the
     opening figure, and would report a bill "missed" that was never logged. */
  const firstUse = moves.length ? moves[0].date : today;
  const past = [];
  for (let s = prevStatement(stmt, card.statementDay); past.length < history && s >= firstUse; s = prevStatement(s, card.statementDay)) {
    const b = bill(s);
    if (b.billed <= NEAR_ZERO && b.spent <= NEAR_ZERO) continue;
    const settled = b.paidByDue + NEAR_ZERO >= b.billed ? 'paid'
      : b.paidByDue + NEAR_ZERO >= b.minDue ? 'min_paid' : 'missed';
    past.push({ ...b, status: b.billed <= NEAR_ZERO ? 'clear' : settled });
  }

  return {
    name,
    ...card,
    balance: r2(balance),
    owed,
    credit: r2(Math.max(0, balance)),         // overpaid: the bank owes you
    available,
    utilization: card.limit > 0 ? owed / card.limit : null,
    statement: { ...current, status, daysLeft },
    cycle: {
      start: addDays(stmt, 1),
      end: next,
      unbilled: r2(chargesIn(stmt, today)),
      credits: r2(creditsIn(stmt, today)),
      daysToStatement: daysBetween(today, next),
    },
    nextDue,
    freeDays: daysBetween(today, nextDue),
    bestDay,
    maxFreeDays: daysBetween(bestDay, dueAfter(nextStatement(addDays(bestDay, -1), card.statementDay), card.dueDay)),
    interestIfCarried,
    history: past,
  };
}
