import { dayLabel } from './format.js';

/*
 * How a credit card's bill is spoken about. The arithmetic is the server's
 * (server/src/lib/credit.js); this is only the wording, kept in one place so
 * the home screen and the card's own sheet never describe the same bill two
 * different ways.
 */

// What a fresh card starts with. The limit is left for you to fill in.
export const CARD_DEFAULTS = { limit: '', statementDay: 1, dueDay: 20, apr: 42, minPct: 5, minFloor: 200 };

export const isCard = (settings, name) => !!settings?.creditCards?.[name];

/** 1 → 1st, 22 → 22nd — how a day of the month is said on a bill. */
export function ordinal(n) {
  const v = Number(n) || 0;
  const s = v % 100 >= 11 && v % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[v % 10] || 'th');
  return `${v}${s}`;
}

const inDays = (d) => (d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`);

/*
 * The one line a card is summed up by, and the tone it is said in. Overdue is
 * the only thing that is ever red: a bill that is merely due is a reminder,
 * not an alarm.
 */
export function billLine(st, money) {
  switch (st.status) {
    case 'clear':    return { tone: 'flat', badge: 'No bill', text: 'Nothing to pay this cycle' };
    case 'paid':     return { tone: 'in',   badge: 'Paid', text: `${money(st.billed)} bill paid in full` };
    case 'min_paid': return {
      tone: st.daysLeft <= 3 ? 'warn' : 'save', badge: 'Min paid',
      text: `${money(st.remaining)} left to clear by ${dayLabel(st.dueDate)} — ${inDays(st.daysLeft)}`,
    };
    case 'due':      return {
      tone: st.daysLeft <= 3 ? 'warn' : 'save', badge: st.daysLeft <= 3 ? 'Due soon' : 'Due',
      text: `${money(st.remaining)} due ${dayLabel(st.dueDate)} — ${inDays(st.daysLeft)}`,
    };
    case 'carried':  return {
      tone: 'warn', badge: 'Interest',
      text: `${money(st.remaining)} carried over — interest is running on it`,
    };
    case 'overdue':  return {
      tone: 'out', badge: 'Overdue',
      text: `${money(st.remaining)} overdue since ${dayLabel(st.dueDate)} — pay at least ${money(Math.max(st.remainingMin, 0) || st.remaining)}`,
    };
    default:         return { tone: 'flat', badge: '', text: '' };
  }
}

export const HISTORY_LABEL = {
  paid: ['Paid in full', 'in'],
  min_paid: ['Minimum only', 'warn'],
  missed: ['Missed', 'out'],
  clear: ['Nothing due', 'flat'],
};

/* How much of the limit is in use, and what that says about it. Under 30% is
   what credit scores like to see; past 75% the card is close to refusing. */
export function utilTone(u) {
  if (u === null || u === undefined) return 'flat';
  if (u >= 0.75) return 'out';
  if (u >= 0.3) return 'warn';
  return 'in';
}
