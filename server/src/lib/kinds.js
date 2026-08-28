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

// theyOweMe = lent − repay_received − settle_received
// iOweThem  = borrowed − repay_paid − settle_paid
export function debtNet(p) {
  const theyOweMe = (p.lent || 0) - (p.repay_received || 0) - (p.settle_received || 0);
  const iOweThem = (p.borrowed || 0) - (p.repay_paid || 0) - (p.settle_paid || 0);
  return { theyOweMe, iOweThem };
}
