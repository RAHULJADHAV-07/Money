// Every money movement is one ledger entry. `dir` is its effect on cash-in-hand.
export const KINDS = {
  expense:        { label: 'Expense',        dir: -1, needs: 'category' },
  income:         { label: 'Income',         dir: +1, needs: 'source' },
  lent:           { label: 'Lent out',       dir: -1, needs: 'person' },
  borrowed:       { label: 'Borrowed',       dir: +1, needs: 'person' },
  repay_received: { label: 'Repaid to me',   dir: +1, needs: 'person' },
  repay_paid:     { label: 'I repaid',       dir: -1, needs: 'person' },
  saving_in:      { label: 'To savings',     dir: -1, needs: 'goal' },
  saving_out:     { label: 'From savings',   dir: +1, needs: 'goal' },
};

export const KIND_LIST = Object.keys(KINDS);
export const dirOf = (k) => KINDS[k]?.dir ?? 0;
