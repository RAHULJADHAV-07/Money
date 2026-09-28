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
    version: '2.5.0',
    title: 'Credit cards, rebuilt so the numbers always add up',
    changes: [
      'A credit limit is never money any more. It lives on the card and nowhere else — not in your balance, not as income, not as an opening balance. If a limit had been logged as income into a card, or typed in as what you owed when you started, the app has fixed it for you: the entry is set aside (not deleted) and the card now shows what you really owe.',
      'Every card shows four separate numbers, each labelled: Spent this cycle, Paid this cycle, Outstanding (what you owe now) and Available credit — plus the day the statement closes and the day payment is due. The home screen has a Credit cards section of its own, away from the money you actually have.',
      'Adding a card asks only for what matters: a name, the limit, the statement date and when it renews or expires. The due date, minimum due, interest, opening outstanding and notes are all optional, and the card works with none of them. Cards now live under More → Credit cards, where you can also rename one — every entry moves with it — or give it a colour.',
      'Pay card: choose the amount — the statement balance, everything owed, the minimum, or your own figure — and which wallet it comes from. It lowers what you owe and your bank balance together, and it is never counted as spending, so nothing is counted twice.',
      'A new entry type, Refund, for money back on a purchase. On a card it lowers what you owe; either way it comes off that category’s spending instead of pretending to be income.',
      'The ledger speaks card: pick a card under Paid with and it shows that card’s spending and payments for the period you choose — this cycle, last statement, any month’s statement, or all time — with what you owe now shown separately. Everywhere else, Money in and Money out now mean real money: a card purchase is not money out, paying the card bill is.',
      'Each card’s screen also has a custom period, all-time totals, earlier statements and whether each was paid in full, and marks a card expired once its expiry month has passed — keeping every statement and entry.',
    ],
  },
  {
    version: '2.4.0',
    title: 'Credit cards that work like credit cards',
    changes: [
      'Any wallet can now be a credit card. More → Wallets has a tick box under each one; tick it and tell the app your limit, the day your statement is made up, the day the bill is due, and the interest rate. If you already owed something when you started, put that in too.',
      'Spending on a card no longer comes out of your balance in hand — because it does not. It adds to what you owe the bank, which shows on its own card on the home screen and comes off your net worth. Your spending by category still counts it the day you swiped, so where your money went stays true.',
      'Each card shows its bill the way the bank prints it: the statement amount, the minimum due, the due date, what you have paid since and what is left. It tells you when a bill is due soon, when only the minimum was paid and interest is running, and when it is overdue.',
      'Pay the bill straight from the card — full amount, minimum, or anything else. It is logged as a transfer from your bank into the card, not as spending, so nothing is ever counted twice.',
      'See what you have spent in the cycle that has not been billed yet, how many interest-free days a purchase today gets, the best day of the month to buy, and your last six statements with whether each one was paid in full.',
      'A card can no longer be taken past its limit, and a cash withdrawal from one warns you that interest starts the same day.',
    ],
  },
  {
    version: '2.3.0',
    title: 'A proper welcome, a way back in, and colours that agree with each other',
    changes: [
      'New here? The app now walks you through it in five steps, and the last one asks what is already in each of your wallets. That matters more than it sounds: an entry that would take a wallet below zero is refused, so starting at zero meant your very first expense was turned away with no explanation. You can skip the whole thing.',
      'Forgotten your password? There is a link on the sign-in screen now. It emails you a link that works for 45 minutes and only once, and signs you in as soon as you have chosen a new one.',
      'Splitting something now asks what happened first — a bill you shared, money that came to you, or money you paid out. The shared-bill option was previously buried behind a link almost nobody found, so the prompt that asked "was this a bill you shared?" could not actually get you there. Whatever you had already typed follows you in.',
      'Your data can now leave as a proper statement. More → Your data → Export asks for a format, a period and a wallet: a PDF laid out the way a bank lays one out — opening balance, what went out, what came in, a running balance down the side and a closing figure that proves the page — or an Excel file with the columns sized, the money in real number cells and the totals already summed, or plain CSV. Pick a month, a range of dates, or everything, and one wallet or all of them.',
      'Tap the moon at the top of any screen and you can choose the app’s colour. Pick one of ten, or drag the slider to anything in between, and the whole app follows — the balance card, the wallet cards, the buttons, the calendar, down to the tint in the panels. Light, dark or follow-your-phone lives there too, with four ways to set how strongly the colour comes through. Money in stays green and money out stays red whatever you pick, so what you lent and what you borrowed are still readable at a glance.',
    ],
  },
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
