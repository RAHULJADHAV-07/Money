/*
 * What changed, in the words of someone using the app rather than someone who
 * built it. Shown once, after the version it belongs to has been installed.
 *
 * Add a new entry at the top when you bump the version in package.json. Anyone
 * who skipped a release sees every entry they missed, newest first.
 */

import { isNewer } from './version.js';

export const CHANGELOG = [
  {
    version: '2.1.1',
    title: 'A simpler way to add, and balances where you pick a wallet',
    changes: [
      'Adding an entry starts with three choices instead of eleven. Expense, income and transfer are there straight away, and everything else — lending, repayments, savings — sits behind one tap. The amount box is now the first thing under them rather than halfway down the sheet.',
      'The types that involve someone else now say who did what: “I lent”, “They repaid me”, “Drop what they owe”. Waived and Forgiven never made it clear whose money was whose. Entries you have already saved read exactly as they did before.',
      'The ledger’s wallet filter now carries balances. Open it and every wallet shows what it holds; pick one and the exact figure sits beside the label — so you can check what is left in Cash or UPI without leaving the screen.',
      'Every dropdown in the app has been tidied up: a clearer arrow that answers when you point at it, and longer names that clip instead of stretching the screen. On Chrome and Edge the list you drop down is now drawn by the app itself — rounded, in your theme, with the chosen row picked out in green instead of system blue. Firefox and Safari keep the list their system draws, which is unchanged.',
      'Updates announce themselves properly now. Instead of a line at the bottom of the screen there is a panel that says what is happening, counts the wait out, and lets you reload straight away if you would rather not wait for it.',
    ],
  },
  {
    version: '2.0.1',
    title: 'Routines that know their dates',
    changes: [
      'A routine can now be given a start and an end date — rent from the month you move in, a daily saving only until December. Both are optional, and outside those days the routine simply stays off your dashboard. Set them under More → Routines.',
      'The password boxes in settings have an eye, so you can check what you typed before saving it.',
      'The home screen no longer switches months. It is always this month; the ledger is where you go back through them.',
    ],
  },
  {
    version: '2.0.0',
    title: 'Splits, routines, and a ledger that shows everything',
    changes: [
      'Split an entry — one payment that meant more than one thing. A bill you shared, or ₹100 back from someone when only ₹90 was the loan. You describe what happened and the app works out the entries.',
      'Routines — save an entry you make constantly, like ₹100 into the jar, and it becomes one tap on the home screen. Set them up under More → Routines.',
      'The ledger now opens on everything you have ever logged, not just this month, with two filters: what kind of entry, and which wallet paid for it.',
      'Adding an entry shows every type at once, grouped into everyday, with people, and savings — no more sideways scrolling to find one.',
      'A simpler home screen: balance, your wallets, your routines, what you are owed, and where the money went.',
      'Deleting anything now asks properly inside the app, and says exactly what will go.',
      'Monthly budgets have been retired.',
    ],
  },
];

/** Everything released since the version last seen on this device, newest first. */
export const entriesSince = (seen) => CHANGELOG.filter((e) => isNewer(e.version, seen));
