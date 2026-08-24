// Mirrors the server's ledger kinds, plus how each one presents in the UI.
export const KINDS = {
  expense:        { label: 'Spent',        short: 'Expense',  dir: -1, needs: 'category', icon: '↑', tone: 'out' },
  income:         { label: 'Received',     short: 'Income',   dir: +1, needs: 'source',   icon: '↓', tone: 'in'  },
  lent:           { label: 'Lent out',     short: 'Lent',     dir: -1, needs: 'person',   icon: '→', tone: 'out' },
  borrowed:       { label: 'Borrowed',     short: 'Borrowed', dir: +1, needs: 'person',   icon: '←', tone: 'in'  },
  repay_received: { label: 'Got back',     short: 'Got back', dir: +1, needs: 'person',   icon: '←', tone: 'in'  },
  repay_paid:     { label: 'Paid back',    short: 'Paid back',dir: -1, needs: 'person',   icon: '→', tone: 'out' },
  saving_in:      { label: 'To savings',   short: 'Saved',    dir: -1, needs: 'goal',     icon: '⌂', tone: 'save'},
  saving_out:     { label: 'From savings', short: 'Withdrew', dir: +1, needs: 'goal',     icon: '⌂', tone: 'in'  },
};

// The order the quick-add sheet offers them in — most used first.
export const ADD_ORDER = ['expense', 'income', 'lent', 'borrowed', 'repay_received', 'repay_paid', 'saving_in', 'saving_out'];

export const labelOf = (k) => KINDS[k]?.label || k;
export const dirOf = (k) => KINDS[k]?.dir ?? 0;
