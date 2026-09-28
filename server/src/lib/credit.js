import { dirOf } from './kinds.js';

/*
 * Credit cards.
 *
 * Five things are kept apart here, because every bug this file has ever had
 * came from letting two of them share one number:
 *
 *   REAL MONEY       what Bank, Cash, UPI hold. Never touched by a card.
 *   CREDIT FACILITY  the limit, and the credit still available under it.
 *   LIABILITY        what is outstanding on the card right now.
 *   ACTIVITY         purchases, refunds and payments — the ledger rows.
 *   STATEMENT        one closed cycle: what it billed, what has been paid.
 *
 * A card is a wallet whose balance runs *below* zero by what is owed. That
 * balance is never stored anywhere: it is the opening outstanding plus every
 * ledger row that touched the card, so it cannot drift from the entries. The
 * limit is a setting and nothing else — it is never income, never an opening
 * balance, never cash.
 *
 *   A purchase   expense, paid with the card    → outstanding up, spending up
 *   A refund     refund, into the card          → outstanding down, spending down
 *   A payment    transfer, Bank → card          → outstanding down, Bank down,
 *                                                 and not spending at all
 *
 * The month runs: cycle (spend) → statement date → grace period → due date.
 * A statement dated the 26th closes the cycle 27 Aug → 26 Sep; spending on the
 * 27th already belongs to the next one.
 */

const NEAR_ZERO = 0.005;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));
const within = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const MIN_FLOOR = 200;   // the smallest minimum due banks in India ask for

/*
 * One card's terms, made safe. Only the limit and the statement day are needed
 * for any of the maths; everything else is optional and comes back as null
 * when it was left empty, so "not set" is never mistaken for "zero".
 */
export function cleanCard(raw = {}) {
  const limit = num(raw.limit);
  const statementDay = Math.round(num(raw.statementDay));
  const dueDay = Math.round(num(raw.dueDay));
  const apr = num(raw.apr);
  const minPct = num(raw.minPct);
  const renewal = raw.renewal && typeof raw.renewal === 'object' && MONTH.test(String(raw.renewal.month || ''))
    ? { kind: raw.renewal.kind === 'expiry' ? 'expiry' : 'annual', month: raw.renewal.month }
    : null;
  return {
    limit: within(limit, 0, 1e10) ? r2(limit) : 0,
    statementDay: within(statementDay, 1, 31) ? statementDay : 1,
    dueDay: within(dueDay, 1, 31) ? dueDay : null,
    apr: within(apr, 0, 100) ? r2(apr) : null,
    minPct: within(minPct, 0, 100) ? r2(minPct) : null,
    renewal,
    color: typeof raw.color === 'string' && raw.color.length <= 80 ? raw.color : '',
    notes: typeof raw.notes === 'string' ? raw.notes.trim().slice(0, 500) : '',
  };
}

/** What is wrong with a card someone is saving, or null. The three required fields. */
export function cardProblem(raw = {}) {
  if (!(num(raw.limit) > 0)) return 'Enter the credit limit — it is printed on your card statement';
  if (!within(Math.round(num(raw.statementDay)), 1, 31)) return 'Choose the day your statement is made up';
  if (!raw.renewal || !MONTH.test(String(raw.renewal.month || ''))) return 'Choose the month the card renews or expires';
  const opening = num(raw.openingOutstanding);
  if (Number.isFinite(opening) && opening < 0) return 'Opening outstanding cannot be negative';
  return null;
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
 * holds. For a card it is the credit left — limit − outstanding, or limit plus
 * whatever was overpaid — and never anything to do with any other wallet.
 */
export function availableIn(name, balances, cards) {
  const balance = balances[name] || 0;
  const card = cards[name];
  if (!card) return balance;
  if (!(card.limit > 0)) return Infinity;
  return card.limit + balance;
}

/*
 * What one ledger row did to this card, and what kind of thing it was:
 *   charge   a purchase (or a cash withdrawal) — outstanding goes up
 *   refund   money back on a purchase         — outstanding goes down
 *   payment  money paid in to the card        — outstanding goes down
 */
export function cardMove(t, card) {
  const date = String(t.date).slice(0, 10);
  if (t.kind === 'transfer') {
    if (t.method === card) return { date, effect: -t.amount, type: 'charge' };
    if (t.to_method === card) return { date, effect: t.amount, type: 'payment' };
    return null;
  }
  if (t.method !== card) return null;
  if (t.kind === 'refund') return { date, effect: t.amount, type: 'refund' };
  const d = dirOf(t.kind);
  if (d < 0) return { date, effect: -t.amount, type: 'charge' };
  if (d > 0) return { date, effect: t.amount, type: 'payment' };
  return null;
}

/** What happened on the card between two days, both included. */
export function activity(moves, from, to) {
  const a = { purchases: 0, refunds: 0, paid: 0, count: 0 };
  for (const m of moves) {
    if ((from && m.date < from) || (to && m.date > to)) continue;
    a.count++;
    if (m.type === 'charge') a.purchases += -m.effect;
    else if (m.type === 'refund') a.refunds += m.effect;
    else a.paid += m.effect;
  }
  return {
    from: from || null, to: to || null,
    purchases: r2(a.purchases), refunds: r2(a.refunds),
    spent: r2(a.purchases - a.refunds),     // what the card was used for, net of refunds
    paid: r2(a.paid),
    count: a.count,
  };
}

/* ── Calendar arithmetic, on 'YYYY-MM-DD' keys ─────────────────────────────── */

const parse = (k) => { const [y, m, d] = k.split('-').map(Number); return { y, m: m - 1, d }; };
const key = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const lastDay = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
// Day 31 in a 30-day month is the 30th, the way every bank reads it.
const onDay = (y, m, day) => key(y, m, Math.min(day, lastDay(y, m)));
export const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
export const addDays = (k, n) => { const t = new Date(`${k}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };

/** The last statement strictly before `today`. On the statement day itself the
    cycle is still open — the statement is made up at the end of that day. */
export function lastStatement(today, day) {
  const { y, m } = parse(today);
  const here = onDay(y, m, day);
  return here < today ? here : onDay(y, m - 1, day);
}

export function nextStatement(after, day) {
  const { y, m } = parse(after);
  const here = onDay(y, m, day);
  return here > after ? here : onDay(y, m + 1, day);
}

const prevStatement = (stmt, day) => { const { y, m } = parse(stmt); return onDay(y, m - 1, day); };

/** The cycle whose statement is made up in `month` ('YYYY-MM'): that month's bill. */
export function cycleOfMonth(month, day) {
  const [y, m] = month.split('-').map(Number);
  const end = onDay(y, m - 1, day);
  return { start: addDays(prevStatement(end, day), 1), end };
}

/** The first `dueDay` after the statement date, or null when no due day is set. */
export function dueAfter(stmt, dueDay) {
  if (!dueDay) return null;
  const { y, m } = parse(stmt);
  const same = onDay(y, m, dueDay);
  return same > stmt ? same : onDay(y, m + 1, dueDay);
}

/** The smallest payment that keeps the card in good standing, or null if no rule is set. */
export function minimumDue(billed, card) {
  if (card.minPct === null || card.minPct === undefined) return null;
  if (billed <= NEAR_ZERO) return 0;
  return r2(Math.min(billed, Math.max(MIN_FLOOR, (billed * card.minPct) / 100)));
}

/*
 * Renewal is metadata and a reminder, nothing more. It never resets a
 * statement, the outstanding or the history. An annual renewal rolls forward
 * every year; an expiry date, once passed, marks the card inactive — its
 * statements and entries all stay.
 */
export function renewalState(renewal, today) {
  if (!renewal) return null;
  const [y, m] = renewal.month.split('-').map(Number);
  const [ty, tm] = today.split('-').map(Number);
  if (renewal.kind === 'expiry') {
    const last = key(y, m - 1, lastDay(y, m - 1));
    return { ...renewal, next: renewal.month, expired: today > last, daysLeft: daysBetween(today, last) };
  }
  /* Annual: the renewal month entered, or — once that has gone by — the next
     time the same month comes round, this month included. */
  const current = `${ty}-${String(tm).padStart(2, '0')}`;
  const year = renewal.month >= current ? y : tm <= m ? ty : ty + 1;
  const next = `${year}-${String(m).padStart(2, '0')}`;
  return { ...renewal, next, expired: false, daysLeft: daysBetween(today, `${next}-01`) };
}

/*
 * Everything about one card, as of `today`.
 *
 * `rows` are every ledger entry that touched the card, oldest first; `opening`
 * is the wallet's opening balance — negative by what was already outstanding
 * when the card was added, and zero for a new card.
 */
export function cardReport(name, card, rows, opening, today, { history = 6 } = {}) {
  const moves = rows.map((t) => cardMove(t, name)).filter((x) => x && Math.abs(x.effect) > NEAR_ZERO);

  const balanceAt = (k) => moves.reduce((n, x) => (x.date <= k ? n + x.effect : n), opening);
  // Payments and refunds applied after a statement, up to a day: what went towards that bill.
  const creditsIn = (after, upTo) => moves.reduce((n, x) => (x.date > after && x.date <= upTo && x.effect > 0 ? n + x.effect : n), 0);

  const balance = moves.reduce((n, x) => n + x.effect, opening);
  const outstanding = r2(Math.max(0, -balance));
  const inCredit = r2(Math.max(0, balance));
  const available = card.limit > 0 ? r2(card.limit + balance) : null;

  const stmt = lastStatement(today, card.statementDay);     // the last statement made up
  const closes = nextStatement(stmt, card.statementDay);    // the one the current cycle closes on

  /* One closed statement: what it billed, and what has been paid towards it
     since — counted from the day after it was made up, the way a bank applies
     payments. Without a due day, "paid in time" means before the next one. */
  const bill = (s) => {
    const next = nextStatement(s, card.statementDay);
    const billed = r2(Math.max(0, -balanceAt(s)));
    const due = dueAfter(s, card.dueDay);
    const deadline = due || next;
    const minDue = minimumDue(billed, card);
    const paid = r2(creditsIn(s, today));
    const cycle = { start: addDays(prevStatement(s, card.statementDay), 1), end: s };
    return {
      date: s, cycleStart: cycle.start, dueDate: due, billed, minDue,
      spent: activity(moves, cycle.start, cycle.end).spent,
      paid, paidInTime: r2(creditsIn(s, deadline < today ? deadline : today)),
      remaining: r2(Math.max(0, billed - paid)),
      remainingMin: minDue === null ? null : r2(Math.max(0, minDue - paid)),
      deadline,
    };
  };

  const last = bill(stmt);
  const daysLeft = last.dueDate ? daysBetween(today, last.dueDate) : null;

  /* Where the last statement stands. Nothing billed beats everything, then
     paid in full; without a due date the bill is simply open until paid. */
  let status;
  if (last.billed <= NEAR_ZERO) status = 'clear';
  else if (last.remaining <= NEAR_ZERO) status = 'paid';
  else if (daysLeft === null) status = 'open';
  else if (daysLeft >= 0) status = last.remainingMin !== null && last.remainingMin <= NEAR_ZERO ? 'min_paid' : 'due';
  else status = last.minDue !== null && last.paidInTime + NEAR_ZERO >= last.minDue ? 'carried' : 'overdue';

  const cycle = {
    start: addDays(stmt, 1),
    end: closes,
    ...activity(moves, addDays(stmt, 1), closes),
    daysToClose: daysBetween(today, closes),
    dueDate: dueAfter(closes, card.dueDay),
  };

  /* Earlier statements, newest first, only as far back as the card has been
     used here. A statement from before the first entry knows nothing but the
     opening figure, and would report a bill "missed" that was never logged. */
  const firstUse = moves.length ? moves[0].date : today;
  const past = [];
  for (let s = prevStatement(stmt, card.statementDay); past.length < history && s >= firstUse; s = prevStatement(s, card.statementDay)) {
    const b = bill(s);
    if (b.billed <= NEAR_ZERO && b.spent <= NEAR_ZERO) continue;
    let st = 'clear';
    if (b.billed > NEAR_ZERO) {
      st = b.paidInTime + NEAR_ZERO >= b.billed ? 'paid'
        : b.minDue !== null && b.paidInTime + NEAR_ZERO >= b.minDue ? 'min_paid'
        : b.paidInTime > NEAR_ZERO ? 'part_paid' : 'unpaid';
    }
    past.push({ ...b, status: st });
  }

  // A purchase today is due on the due date of the cycle it lands in.
  const bestDay = addDays(closes, 1);
  const renewal = renewalState(card.renewal, today);

  return {
    name,
    ...card,
    renewal,
    expired: !!renewal?.expired,
    outstanding,
    inCredit,
    available,
    utilization: card.limit > 0 ? outstanding / card.limit : null,
    cycle,
    statement: { ...last, status, daysLeft },
    allTime: activity(moves),
    freeDays: cycle.dueDate ? daysBetween(today, cycle.dueDate) : null,
    bestDay,
    maxFreeDays: card.dueDay ? daysBetween(bestDay, dueAfter(nextStatement(closes, card.statementDay), card.dueDay)) : null,
    interestIfCarried: card.apr ? r2(last.remaining * (card.apr / 1200)) : null,
    history: past,
  };
}
