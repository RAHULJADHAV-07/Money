import { partSides, partTotals } from './kinds.js';

/*
 * The arithmetic a split has to satisfy.
 *
 * Kept out of the route so both rules can be read -- and tested -- on their own,
 * because between them they are the whole feature: what the parts must add up
 * to, and what the split does to a wallet.
 */

export const NEAR_ZERO = 0.005;   // amounts are stored to the paisa; ignore float dust
export const paise = (n) => Math.round(n * 100) / 100;

/* Nothing may be left over. `received` and `paid` are what actually changed
   hands; every part lands on one side, the other, or -- a pass-through -- both. */
export function reconcile(parts, received, paid) {
  const total = partTotals(parts);
  const inLeft = paise(received - total.in);
  const outLeft = paise(paid - total.out);
  return {
    in: paise(total.in),
    out: paise(total.out),
    inLeft,
    outLeft,
    ok: Math.abs(inLeft) < NEAR_ZERO && Math.abs(outLeft) < NEAR_ZERO,
  };
}

/*
 * What the split does to each wallet, on net.
 *
 * A split is one moment: the cash that arrives and the cash that leaves do so
 * together. Weighing each part against the wallet on its own would refuse the
 * commonest split there is -- someone hands you their share and you pay the
 * bill with it -- because the payment would be measured against a wallet that
 * had not yet been handed the cash.
 */
export function walletDelta(parts) {
  const delta = {};
  for (const p of parts) {
    const side = partSides(p);
    const wallet = p.method || 'Cash';
    delta[wallet] = paise((delta[wallet] || 0) + side.in - side.out);
  }
  return delta;
}

// Only a wallet the split genuinely leaves short, in the order they were named.
export const drains = (parts) =>
  Object.entries(walletDelta(parts)).filter(([, d]) => d < -NEAR_ZERO);
