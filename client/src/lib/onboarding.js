import { useEffect, useState } from 'react';
import { api } from './api.js';

/*
 * Whether this account has ever been used.
 *
 * The question is about the *account*, not the browser, and getting that wrong
 * is what broke the first version of this: it keyed off `hisab.version.seen`,
 * which any returning device carries regardless of who is signed in. Anyone who
 * had used the app before and then made a fresh account was treated as an old
 * hand and shown nothing — which is precisely the person the tour exists for.
 *
 * So the signal comes from the ledger instead: an account with no entries and
 * no opening balances has never been used, whatever the device remembers. That
 * also settles the mirror case for free — an established user on a brand-new
 * phone has data, so they are left alone.
 *
 * Only the dismissal is stored locally, and it is stored per account, so two
 * people sharing a browser do not inherit each other's answer.
 */

const keyFor = (userId) => `hisab.onboarded.${userId}`;

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window */ } };

/** `how` rather than a bare flag — worth knowing whether they skipped. */
export const markOnboarded = (userId, how = 'done') => write(keyFor(userId), how);

const dismissed = (userId) => !!read(keyFor(userId));

/**
 * 'unknown' until the ledger has answered, then 'tour' or 'none'.
 *
 * Three states rather than a boolean because the caller has to show neither the
 * tour nor the release notes while it is still deciding — one or the other
 * flashing up and being replaced is worse than a moment of nothing.
 */
export function useFirstRun(user, settings) {
  const [state, setState] = useState('unknown');

  useEffect(() => {
    if (!user?.id) return undefined;
    /* Decided once and then left alone. `settings` is replaced after every
       write, so without this the question would be re-asked mid-tour — and the
       moment someone logged their first entry the answer would flip and the
       tour would vanish out from under them. */
    if (state !== 'unknown') return undefined;
    if (dismissed(user.id)) { setState('none'); return undefined; }

    // An opening balance is itself proof of having been set up.
    const opened = Object.values(settings?.openingBalances || {}).some((v) => Number(v) > 0);
    if (opened) { setState('none'); return undefined; }

    let alive = true;
    /* One row is all it takes to know: `total` comes back with the page, so the
       cheapest possible request answers the question. */
    api.transactions({ limit: 1 })
      .then((r) => alive && setState((r?.total ?? 0) === 0 ? 'tour' : 'none'))
      // A failed probe must not greet someone with a tour they do not need.
      .catch(() => alive && setState('none'));
    return () => { alive = false; };
  }, [user?.id, settings, state]);

  return state;
}
