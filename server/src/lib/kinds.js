// Every money movement is one ledger entry. `dir` is its effect on cash-in-hand.
//   dir -1  money leaves you    dir +1  money reaches you    dir 0  no cash moves
export const KINDS = {
  expense:        { label: 'Expense',        dir: -1, needs: 'category' },
  income:         { label: 'Income',         dir: +1, needs: 'source' },
  lent:           { label: 'Lent out',       dir: -1, needs: 'person' },
  borrowed:       { label: 'Borrowed',       dir: +1, needs: 'person' },
  repay_received: { label: 'Repaid to me',   dir: +1, needs: 'person' },
  repay_paid:     { label: 'I repaid',       dir: -1, needs: 'person' },
  saving_in:      { label: 'To savings',     dir: -1, needs: 'goal' },
  saving_out:     { label: 'From savings',   dir: +1, needs: 'goal' },

  // Money you only carried: collected from someone and handed straight on. It
  // comes in and goes out in the same breath, so the net effect on your wallet
  // is nil -- and it is neither an expense, an income, nor a debt. It exists so
  // that money passing through your hands is visible instead of vanishing.
  pass_through:   { label: 'Passed on',      dir: 0, needs: 'person' },

  // Settled by agreement — the debt clears but no money changes hands.
  settle_received: { label: 'Waived off',    dir: 0, needs: 'person' },
  settle_paid:     { label: 'Forgiven',      dir: 0, needs: 'person' },

  // Moving your own money between wallets. Total cash is unchanged; only the
  // per-method balances shift, so it is handled separately from `dir`.
  transfer:       { label: 'Transfer',       dir: 0, needs: 'transfer' },
};

export const KIND_LIST = Object.keys(KINDS);
export const dirOf = (k) => KINDS[k]?.dir ?? 0;

// Kinds that change what someone owes, and by how much, per person.
export const DEBT_KINDS = ['lent', 'borrowed', 'repay_received', 'repay_paid', 'settle_received', 'settle_paid'];

/* Which side of a split a part lands on. A pass-through counts on both: the
   money arrived and left again, so it has to be accounted for twice or the
   two sides of the event would not add up. Settlements move no money at all. */
export function partSides(part) {
  if (part.kind === 'pass_through') return { in: part.amount, out: part.amount };
  const d = dirOf(part.kind);
  return { in: d > 0 ? part.amount : 0, out: d < 0 ? part.amount : 0 };
}

export function partTotals(parts) {
  return parts.reduce((t, p) => {
    const s = partSides(p);
    return { in: t.in + s.in, out: t.out + s.out };
  }, { in: 0, out: 0 });
}

// theyOweMe = lent − repay_received − settle_received
// iOweThem  = borrowed − repay_paid − settle_paid
export function debtNet(p) {
  const theyOweMe = (p.lent || 0) - (p.repay_received || 0) - (p.settle_received || 0);
  const iOweThem = (p.borrowed || 0) - (p.repay_paid || 0) - (p.settle_paid || 0);
  return { theyOweMe, iOweThem };
}
