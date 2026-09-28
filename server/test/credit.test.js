import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanCard, cardProblem, cardReport, activity, cardMove, cycleOfMonth,
  lastStatement, nextStatement, dueAfter, renewalState, availableIn,
} from '../src/lib/credit.js';
import { balancesFrom } from '../src/lib/wallets.js';
import { cycleOfMonth as clientCycleOfMonth, currentCycle as clientCurrentCycle } from '../../client/src/lib/credit.js';

/*
 * The credit card scenarios, end to end on the pure maths: the same functions
 * the dashboard, the card screen and the spending guard all call.
 */

const CARD = 'HDFC';
const terms = (over = {}) => cleanCard({
  limit: 100000, statementDay: 26, dueDay: 11,
  renewal: { kind: 'annual', month: '2027-09' }, ...over,
});
const spend = (date, amount, method = CARD) => ({ date, kind: 'expense', amount, method, to_method: '' });
const refund = (date, amount) => ({ date, kind: 'refund', amount, method: CARD, to_method: '' });
const pay = (date, amount, from = 'Bank') => ({ date, kind: 'transfer', amount, method: from, to_method: CARD });
const report = (rows, today = '2026-09-20', opening = 0, card = terms()) => cardReport(CARD, card, rows, opening, today);

/* The wallet balances the dashboard shows, from the same rows. */
function balances(rows, openings) {
  const movement = {};
  const transferIn = {};
  for (const t of rows) {
    const k = `${t.method}|${t.kind}`;
    movement[k] = (movement[k] || 0) + t.amount;
    if (t.kind === 'transfer') transferIn[t.to_method] = (transferIn[t.to_method] || 0) + t.amount;
  }
  return balancesFrom({
    openings,
    movement: Object.entries(movement).map(([k, total]) => { const [wallet, kind] = k.split('|'); return { wallet, kind, total }; }),
    transferIn: Object.entries(transferIn).map(([wallet, total]) => ({ wallet, total })),
  });
}
const cashInHand = (b, cards) => Object.entries(b).filter(([w]) => !cards.includes(w)).reduce((n, [, v]) => n + v, 0);

test('1 — a new card: full credit, nothing owed, nothing spent', () => {
  const r = report([]);
  assert.equal(r.limit, 100000);
  assert.equal(r.outstanding, 0);
  assert.equal(r.available, 100000);
  assert.equal(r.cycle.spent, 0);
  assert.equal(r.cycle.paid, 0);
});

test('2 — one purchase raises what is owed and leaves the bank alone', () => {
  const rows = [spend('2026-09-05', 5000)];
  const r = report(rows);
  assert.equal(r.outstanding, 5000);
  assert.equal(r.available, 95000);
  assert.equal(r.cycle.spent, 5000);
  const b = balances(rows, { Bank: 50000, [CARD]: 0 });
  assert.equal(b.Bank, 50000);
});

test('3 — a second purchase adds up', () => {
  const r = report([spend('2026-09-05', 5000), spend('2026-09-06', 2000)]);
  assert.equal(r.outstanding, 7000);
  assert.equal(r.available, 93000);
  assert.equal(r.cycle.spent, 7000);
});

test('4 — a partial payment lowers what is owed and the bank, and is not spending', () => {
  const rows = [spend('2026-09-05', 5000), spend('2026-09-06', 2000), pay('2026-09-10', 3000)];
  const r = report(rows);
  assert.equal(r.outstanding, 4000);
  assert.equal(r.available, 96000);
  assert.equal(r.cycle.spent, 7000);     // spending is still what was bought
  assert.equal(r.cycle.paid, 3000);
  assert.equal(balances(rows, { Bank: 50000 }).Bank, 47000);
});

test('5 — a full payment restores the whole limit', () => {
  const r = report([spend('2026-09-05', 5000), spend('2026-09-06', 2000), pay('2026-09-10', 3000), pay('2026-09-12', 4000)]);
  assert.equal(r.outstanding, 0);
  assert.equal(r.available, 100000);
});

test('6 — a statement period includes its closing day and not the day after', () => {
  const rows = [spend('2026-08-28', 1000), spend('2026-09-10', 2000), spend('2026-09-27', 3000)];
  const moves = rows.map((t) => cardMove(t, CARD));
  const period = cycleOfMonth('2026-09', 26);
  assert.deepEqual(period, { start: '2026-08-27', end: '2026-09-26' });
  assert.equal(activity(moves, period.start, period.end).spent, 3000);
  // …and the 27 Sep purchase is the first of the next cycle.
  const r = report(rows, '2026-09-28');
  assert.equal(r.cycle.start, '2026-09-27');
  assert.equal(r.cycle.spent, 3000);
  assert.equal(r.statement.billed, 3000);    // the 26 Sep statement: 1000 + 2000
});

test('7 — the limit is never money in hand', () => {
  const rows = [];
  const b = balances(rows, { Bank: 50000, Cash: 5000, [CARD]: 0 });
  assert.equal(cashInHand(b, [CARD]), 55000);
  assert.equal(availableIn(CARD, b, { [CARD]: terms() }), 100000);
});

test('8 — paying off the card: bank down, nothing owed, no extra expense', () => {
  const rows = [spend('2026-09-05', 10000), pay('2026-09-15', 10000)];
  const r = report(rows);
  assert.equal(r.outstanding, 0);
  assert.equal(r.available, 100000);
  assert.equal(balances(rows, { Bank: 50000 }).Bank, 40000);
  const expenses = rows.filter((t) => t.kind === 'expense').reduce((n, t) => n + t.amount, 0);
  assert.equal(expenses, 10000);
});

test('9 — a refund gives the credit back and nets off the spending', () => {
  const r = report([spend('2026-09-05', 3000), spend('2026-09-06', 2000), refund('2026-09-08', 2000)]);
  assert.equal(r.outstanding, 3000);
  assert.equal(r.available, 97000);
  assert.equal(r.cycle.purchases, 5000);
  assert.equal(r.cycle.refunds, 2000);
  assert.equal(r.cycle.spent, 3000);
  assert.equal(r.cycle.paid, 0);             // a refund is not a payment
});

test('10 — all-time spending, this cycle and outstanding stay separate', () => {
  const rows = [
    spend('2026-05-10', 20000), pay('2026-06-05', 20000),
    spend('2026-07-10', 26000), pay('2026-08-05', 26000),
    spend('2026-09-01', 4000),
  ];
  const r = report(rows);
  assert.equal(r.allTime.spent, 50000);
  assert.equal(r.cycle.spent, 4000);
  assert.equal(r.outstanding, 4000);
});

test('opening outstanding is optional and comes off the available credit', () => {
  assert.equal(report([], '2026-09-20', -20000, terms({ limit: 199999 })).available, 179999);
  assert.equal(report([], '2026-09-20', 0, terms({ limit: 199999 })).available, 199999);
});

test('the card works with every optional field empty', () => {
  const card = cleanCard({ limit: 50000, statementDay: 26, dueDay: '', apr: '', minPct: '', renewal: { kind: 'annual', month: '2027-09' } });
  assert.equal(card.dueDay, null);
  assert.equal(card.apr, null);
  assert.equal(card.minPct, null);
  const r = cardReport(CARD, card, [spend('2026-08-30', 1200)], 0, '2026-10-02');
  assert.equal(r.statement.billed, 1200);
  assert.equal(r.statement.dueDate, null);
  assert.equal(r.statement.minDue, null);
  assert.equal(r.statement.status, 'open');
  assert.equal(r.interestIfCarried, null);
  assert.equal(r.freeDays, null);
});

test('only limit, statement day and renewal are required', () => {
  assert.match(cardProblem({ statementDay: 26, renewal: { month: '2027-09' } }), /limit/);
  assert.match(cardProblem({ limit: 1, renewal: { month: '2027-09' } }), /statement/);
  assert.match(cardProblem({ limit: 1, statementDay: 26 }), /renews or expires/);
  assert.equal(cardProblem({ limit: 1, statementDay: 26, renewal: { kind: 'annual', month: '2027-09' } }), null);
});

test('statement date vs due date: closes 26 Sep, due 11 Oct, next 26 Oct', () => {
  const r = report([spend('2026-09-10', 500)], '2026-09-20');
  assert.equal(r.cycle.start, '2026-08-27');
  assert.equal(r.cycle.end, '2026-09-26');
  assert.equal(r.cycle.dueDate, '2026-10-11');
  assert.equal(nextStatement('2026-09-26', 26), '2026-10-26');
  assert.equal(lastStatement('2026-09-26', 26), '2026-08-26');   // still open on its own day
  assert.equal(dueAfter('2026-09-26', 11), '2026-10-11');
});

test('a bill paid partly stays open, and is overdue once the due date passes unpaid', () => {
  const rows = [spend('2026-09-10', 24577)];
  const due = report(rows, '2026-10-01');
  assert.equal(due.statement.status, 'due');
  const part = report([...rows, pay('2026-10-02', 10000)], '2026-10-05');
  assert.equal(part.statement.paid, 10000);
  assert.equal(part.statement.remaining, 14577);
  assert.equal(part.outstanding, 14577);
  assert.equal(report(rows, '2026-10-15').statement.status, 'overdue');
});

test('renewal is a reminder: it never resets anything, and expiry only marks the card', () => {
  const rows = [spend('2026-09-10', 900)];
  const annual = report(rows, '2026-10-20', 0, terms({ renewal: { kind: 'annual', month: '2025-09' } }));
  assert.equal(annual.renewal.next, '2027-09');
  assert.equal(annual.expired, false);
  const gone = report(rows, '2026-10-20', 0, terms({ renewal: { kind: 'expiry', month: '2026-09' } }));
  assert.equal(gone.expired, true);
  assert.equal(gone.outstanding, 900);
  assert.equal(gone.allTime.spent, 900);
  assert.equal(renewalState({ kind: 'expiry', month: '2026-10' }, '2026-10-31').expired, false);
  // An annual renewal entered for a future month is shown as that month.
  assert.equal(renewalState({ kind: 'annual', month: '2027-09' }, '2026-09-28').next, '2027-09');
});

test('the client and the server agree on every cycle', () => {
  for (const day of [1, 15, 26, 28, 30, 31]) {
    for (const month of ['2026-01', '2026-02', '2026-03', '2026-09', '2026-12']) {
      assert.deepEqual(clientCycleOfMonth(month, day), cycleOfMonth(month, day), `${month} / ${day}`);
    }
    for (const today of ['2026-01-31', '2026-02-28', '2026-03-01', '2026-09-26', '2026-09-27', '2026-12-31']) {
      const r = cardReport(CARD, terms({ statementDay: day }), [], 0, today);
      assert.deepEqual(clientCurrentCycle(today, day), { start: r.cycle.start, end: r.cycle.end }, `${today} / ${day}`);
    }
  }
});
