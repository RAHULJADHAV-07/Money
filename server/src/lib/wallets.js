import { dirOf } from './kinds.js';

/*
 * What each wallet actually holds.
 *
 * Shared by the dashboard and by the check that stops an entry spending money a
 * wallet does not have — if the two ever disagreed, the app would refuse an
 * entry while showing a balance that says it is fine.
 */

// Money in a wallet before anything was logged here.
export function openingsFor(settings) {
  const openings = { ...(settings.openingBalances || {}) };
  // Before wallets existed there was a single opening figure; treat it as the
  // first wallet's, so the wallet balances always add up to the headline one.
  if (!Object.keys(openings).length && settings.openingBalance) {
    openings[(settings.methods || [])[0] || 'Cash'] = settings.openingBalance;
  }
  return openings;
}

export function balancesFrom({ openings = {}, movement = [], transferIn = [] }) {
  const balance = {};
  const touch = (m) => { if (balance[m] === undefined) balance[m] = 0; return m; };

  for (const [m, v] of Object.entries(openings)) balance[m] = Number(v) || 0;

  for (const r of movement) {
    const m = touch(r.wallet || 'Cash');
    // A transfer leaves this wallet whole; it lands in another one below.
    balance[m] += r.kind === 'transfer' ? -r.total : dirOf(r.kind) * r.total;
  }
  for (const r of transferIn) {
    const m = touch(r.wallet);
    balance[m] += r.total;
  }
  return balance;
}

// How much this entry takes *out* of the wallet it names. Income adds, so 0.
export function walletSpend(doc) {
  if (doc.kind === 'transfer') return doc.amount;
  return dirOf(doc.kind) < 0 ? doc.amount : 0;
}
