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
