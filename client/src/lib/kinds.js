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

  // Cleared by agreement — no money moves.
  settle_received: { label: 'Waived off',   short: 'Waived',    cta: 'Mark as waived',    dir: 0, needs: 'person',   icon: '✓', tone: 'flat' },
  settle_paid:     { label: 'Forgiven',     short: 'Forgiven',  cta: 'Mark as forgiven',  dir: 0, needs: 'person',   icon: '✓', tone: 'flat' },

  // Your own money moving between wallets.
  transfer:       { label: 'Transfer',      short: 'Transfer',  cta: 'Add transfer',      dir: 0, needs: 'transfer', icon: '⇄', tone: 'flat' },
};


// The order the quick-add sheet offers them in — most used first.
export const ADD_ORDER = [
  'expense', 'income', 'transfer', 'lent', 'borrowed',
  'repay_received', 'repay_paid', 'settle_received', 'settle_paid',
  'saving_in', 'saving_out',
];

export const labelOf = (k) => KINDS[k]?.label || k;
export const dirOf = (k) => KINDS[k]?.dir ?? 0;
export const isSettle = (k) => k === 'settle_received' || k === 'settle_paid';
