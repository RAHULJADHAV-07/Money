import { partTotals } from './kinds.js';

/*
 * Turning what happened into what the ledger has to say.
 *
 * You answer a handful of plain questions -- what the bill was, who paid it,
 * what each person's share is -- and this works out the entries. The ledger
 * vocabulary (lent, borrowed, passed on) never has to be typed, only read back
 * in the summary, where it is written as a sentence.
 *
 * Everything here is pure, so the sheet can show you what will be recorded
 * before you commit to it.
 */

export const ME = '__me__';
const paise = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* ── Money in and out on its own ───────────────────────────────────────────
   One amount that meant more than one thing. Each reason is a plain sentence
   for something the ledger already knows how to record.                     */

/* Kept short on purpose: each one sits on a single line beside its amount, and
   a label that has to be truncated to fit is no clearer than no label at all. */
export const REASONS = {
  in: [
    { id: 'repaid',   label: 'They repaid me',      kind: 'repay_received',  needs: 'person' },
    { id: 'gift',     label: 'Extra, mine to keep', kind: 'income',          needs: 'source' },
    { id: 'toreturn', label: 'I must give it back', kind: 'borrowed',        needs: 'person' },
    { id: 'waived',   label: 'Written off',         kind: 'settle_received', needs: 'person' },
    { id: 'unsaved',  label: 'Out of savings',      kind: 'saving_out',      needs: 'goal' },
  ],
  out: [
    { id: 'bought',   label: 'Something I bought',  kind: 'expense',         needs: 'category' },
    { id: 'repaying', label: 'I repaid them',       kind: 'repay_paid',      needs: 'person' },
    { id: 'lending',  label: 'Lent to them',        kind: 'lent',            needs: 'person' },
    { id: 'forgiven', label: 'Forgiven',            kind: 'settle_paid',     needs: 'person' },
    { id: 'saved',    label: 'Into savings',        kind: 'saving_in',       needs: 'goal' },
  ],
};

export const reasonOf = (dir, id) => REASONS[dir].find((r) => r.id === id) || REASONS[dir][0];

function flowParts(form) {
  const { direction = 'in', person = '', method = 'Cash', rows = [] } = form;
  return rows
    .filter((r) => paise(r.amount) > 0)
    .map((r) => {
      const reason = reasonOf(direction, r.reason);
      return {
        kind: reason.kind,
        amount: paise(r.amount),
        method,
        note: r.note || '',
        person: reason.needs === 'person' ? person.trim() : '',
        category: reason.needs === 'category' ? (r.category || 'Misc') : '',
        source: reason.needs === 'source' ? (r.source || 'Other') : '',
        goal: reason.needs === 'goal' ? (r.goal || null) : null,
      };
    });
}

/* ── A shared bill ─────────────────────────────────────────────────────────

   Only two things decide the entries: your share of it, and whether you were
   the one who paid.

   When you paid, your share is yours to have spent and everyone else's is
   money they now owe you. When someone else paid, only your share concerns
   your ledger at all -- you spent it, and you owe them for it. What the others
   owe *them* is between the two of them, and recording it here would invent a
   debt that is not yours.                                                    */

function billParts(form) {
  const { total = 0, category = 'Misc', payer = ME, people = [], carried = false, method = 'Cash' } = form;
  const myShare = paise(people.find((p) => p.name === ME)?.share);
  const parts = [];

  if (myShare > 0) parts.push({ kind: 'expense', amount: myShare, category, method, note: 'My share' });

  if (payer === ME) {
    for (const p of people) {
      const share = paise(p.share);
      if (p.name === ME || share <= 0 || !p.name.trim()) continue;
      parts.push({ kind: 'lent', amount: share, person: p.name.trim(), method, note: 'Their share' });
    }
    return parts;
  }

  // Someone else settled the bill, so your share was paid with their money.
  if (myShare > 0) {
    parts.push({ kind: 'borrowed', amount: myShare, person: payer, method, note: `${payer} covered my share` });
  }
  /* Their cash went through your hands on its way to the till. It changes no
     total -- it was never yours -- but without it the money you actually
     handled would be nowhere in the ledger. */
  if (carried) {
    const passing = paise(paise(total) - myShare);
    if (passing > 0) parts.push({ kind: 'pass_through', amount: passing, person: payer, method, note: 'Their share, paid on' });
  }
  return parts;
}

export function derive(form) {
  const parts = form.shape === 'bill' ? billParts(form) : flowParts(form);
  const sides = partTotals(parts);
  return {
    parts,
    received: paise(sides.in),
    paid: paise(sides.out),
    total: paise(form.shape === 'bill' ? form.total : form.amount),
  };
}

/* ── Saying it back ────────────────────────────────────────────────────────
   The sheet shows this before you save. It is the only place the ledger's own
   words appear, and each is a sentence rather than a label.                  */

export function describe(part, money) {
  const amt = money(part.amount);
  switch (part.kind) {
    case 'expense':         return `You spent ${amt}${part.category ? ` on ${part.category}` : ''}`;
    case 'income':          return `${amt} comes in as income`;
    case 'lent':            return `${part.person} owes you ${amt}`;
    case 'borrowed':        return `You owe ${part.person} ${amt}`;
    case 'repay_received':  return `${part.person} paid back ${amt}`;
    case 'repay_paid':      return `You paid ${part.person} back ${amt}`;
    case 'settle_received': return `${amt} ${part.person} owed you is written off`;
    case 'settle_paid':     return `${amt} you owed ${part.person} is forgiven`;
    case 'saving_in':       return `${amt} goes into savings`;
    case 'saving_out':      return `${amt} comes out of savings`;
    case 'pass_through':    return `${amt} of ${part.person}'s money passed through you — yours to hand on, not to keep`;
    default:                return `${amt} ${part.kind}`;
  }
}

/* ── What is not yet answerable ────────────────────────────────────────────
   Every reason a split cannot be saved, in the order you would hit them, so
   the sheet can say the next thing to do rather than just staying greyed out. */

export function problems(form, money) {
  const { parts } = derive(form);

  if (form.shape === 'bill') {
    const total = paise(form.total);
    const people = form.people || [];
    const named = people.filter((p) => p.name === ME || p.name.trim());
    if (total <= 0) return ['Put in what the bill came to'];
    if (named.length < 2) return ['Say who else shared it'];
    if (people.some((p) => p.name !== ME && !p.name.trim())) return ['Give everyone in the split a name'];

    const shares = people.reduce((n, p) => n + paise(p.share), 0);
    const left = paise(total - shares);
    if (Math.abs(left) > 0.005) {
      return [left > 0
        ? `${money(left)} of the bill is not in anyone's share yet`
        : `The shares come to ${money(-left)} more than the bill`];
    }
    if (!parts.length) return ['Nothing here affects you — your share is zero and someone else paid'];
    if (parts.length < 2) return ['A split needs at least two people with a share in it'];
    return [];
  }

  const amount = paise(form.amount);
  const rows = form.rows || [];
  if (amount <= 0) return ['Put in how much it was'];
  if (rows.filter((r) => paise(r.amount) > 0).length < 2) return ['Break it into at least two parts'];

  const needsPerson = rows.some((r) => paise(r.amount) > 0 && reasonOf(form.direction, r.reason).needs === 'person');
  if (needsPerson && !String(form.person || '').trim()) return ['Say who the money was with'];

  const left = paise(amount - rows.reduce((n, r) => n + paise(r.amount), 0));
  if (Math.abs(left) > 0.005) {
    return [left > 0 ? `${money(left)} is still unaccounted for` : `The parts come to ${money(-left)} more than the amount`];
  }
  return [];
}
