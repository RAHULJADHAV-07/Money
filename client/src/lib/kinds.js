// Mirrors the server's ledger kinds, plus how each one presents in the UI.
export const KINDS = {
  expense:        { label: 'Spent',         short: 'Expense',   cta: 'Add expense',      dir: -1, needs: 'category', icon: '↑', tone: 'out' },
  income:         { label: 'Received',      short: 'Income',    cta: 'Add income',       dir: +1, needs: 'source',   icon: '↓', tone: 'in'  },
  lent:           { label: 'Lent out',      short: 'Lent',      cta: 'Record lending',   dir: -1, needs: 'person',   icon: '→', tone: 'out' },
  borrowed:       { label: 'Borrowed',      short: 'Borrowed',  cta: 'Record borrowing', dir: +1, needs: 'person',   icon: '←', tone: 'in'  },
  repay_received: { label: 'Got back',      short: 'Got back',  cta: 'Record repayment', dir: +1, needs: 'person',   icon: '←', tone: 'in'  },
  repay_paid:     { label: 'Paid back',     short: 'Paid back', cta: 'Record repayment', dir: -1, needs: 'person',   icon: '→', tone: 'out' },
  saving_in:      { label: 'To savings',    short: 'Saved',     cta: 'Add to savings',   dir: -1, needs: 'goal',     icon: '⌂', tone: 'save'},
  saving_out:     { label: 'From savings',  short: 'Withdrew',  cta: 'Withdraw',         dir: +1, needs: 'goal',     icon: '⌂', tone: 'in'  },

  // Money you only carried: in one hand, straight out the other. Net zero, and
  // neither an expense nor an income nor a debt -- it is here so that money
  // passing through your hands shows up instead of vanishing.
  pass_through:   { label: 'Passed on',     short: 'Passed on', cta: 'Record pass-through', dir: 0, needs: 'person', icon: '⇢', tone: 'flat' },

  // Cleared by agreement — no money moves.
  settle_received: { label: 'Waived off',   short: 'Waived',    cta: 'Mark as waived',    dir: 0, needs: 'person',   icon: '✓', tone: 'flat' },
  settle_paid:     { label: 'Forgiven',     short: 'Forgiven',  cta: 'Mark as forgiven',  dir: 0, needs: 'person',   icon: '✓', tone: 'flat' },

  // Your own money moving between wallets.
  transfer:       { label: 'Transfer',      short: 'Transfer',  cta: 'Add transfer',      dir: 0, needs: 'transfer', icon: '⇄', tone: 'flat' },
};


// The order the quick-add sheet offers them in — most used first. `pass_through`
// is missing on purpose: on its own it is an entry that does nothing, and it
// only means anything beside the other parts of a split.
export const ADD_ORDER = [
  'expense', 'income', 'transfer', 'lent', 'borrowed',
  'repay_received', 'repay_paid', 'settle_received', 'settle_paid',
  'saving_in', 'saving_out',
];

// What a split's parts can be. A transfer moves money between your own wallets,
// which is not something an event shared with someone else can contain.
export const PART_ORDER = [
  'expense', 'borrowed', 'lent', 'repay_received', 'repay_paid',
  'pass_through', 'income', 'settle_received', 'settle_paid',
  'saving_in', 'saving_out',
];

export const labelOf = (k) => KINDS[k]?.label || k;
export const dirOf = (k) => KINDS[k]?.dir ?? 0;
export const isSettle = (k) => k === 'settle_received' || k === 'settle_paid';

/* Which side of a split a part lands on — mirrors the server's rule. A
   pass-through counts on both sides: the money arrived and left again, so
   leaving it off either one would stop the event adding up. */
export function partSides(part) {
  const amount = Number(part.amount) || 0;
  if (part.kind === 'pass_through') return { in: amount, out: amount };
  const d = dirOf(part.kind);
  return { in: d > 0 ? amount : 0, out: d < 0 ? amount : 0 };
}

export function partTotals(parts) {
  return parts.reduce((t, p) => {
    const s = partSides(p);
    return { in: t.in + s.in, out: t.out + s.out };
  }, { in: 0, out: 0 });
}
