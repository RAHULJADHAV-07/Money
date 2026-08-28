const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const inr0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

export function money(n, currency = '₹') {
  const v = Number(n) || 0;
  const sign = v < 0 ? '-' : '';
  return `${sign}${currency}${inr.format(Math.abs(v))}`;
}

// Big figures on cards read better without paise.
export function moneyRound(n, currency = '₹') {
  const v = Number(n) || 0;
  return `${v < 0 ? '-' : ''}${currency}${inr0.format(Math.abs(v))}`;
}

/* Split for typographic control: the hero sets the symbol small and raised, the
   rupees large, and the paise smaller again — one figure, three sizes. */
export function moneyParts(n, currency = '₹') {
  const v = Number(n) || 0;
  const [whole, paise = ''] = inr.format(Math.abs(v)).split('.');
  return { sign: v < 0 ? '−' : '', currency, whole, paise };
}

export function compact(n) {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return inr0.format(v);
}

export const pct = (n) => `${Math.round((Number(n) || 0) * 100)}%`;

export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const monthKeyNow = () => todayKey().slice(0, 7);

export const dayOf = (iso) => String(iso).slice(0, 10);

export function dayLabel(iso) {
  const key = dayOf(iso);
  const today = todayKey();
  if (key === today) return 'Today';
  const y = new Date(`${today}T00:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (key === y.toISOString().slice(0, 10)) return 'Yesterday';
  const d = new Date(`${key}T00:00:00Z`);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
    ...(d.getUTCFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  });
}

// 'Mon' / 'Tue' … for the second line of a day header.
export function weekdayLabel(key) {
  return new Date(`${dayOf(key)}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' });
}

export function monthLabel(key) {
  const [y, m] = String(key).split('-');
  return new Date(Date.UTC(+y, +m - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function monthShort(key) {
  const [y, m] = String(key).split('-');
  return new Date(Date.UTC(+y, +m - 1, 1)).toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' });
}

export function shiftMonth(key, by) {
  const [y, m] = String(key).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Step a 'YYYY-MM-DD' key by whole days.
export function shiftDay(key, by) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + by);
  return d.toISOString().slice(0, 10);
}

export function fullDayLabel(key) {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

export const daysInMonth = (key) => {
  const [y, m] = String(key).split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/* How far through the month we are. A past month is complete; a future one has
   not started. Used to pace spending without pretending a half-month is a whole one. */
export function monthProgress(key) {
  const now = monthKeyNow();
  if (key < now) return { elapsed: daysInMonth(key), total: daysInMonth(key), current: false };
  if (key > now) return { elapsed: 0, total: daysInMonth(key), current: false };
  return { elapsed: Number(todayKey().slice(8)), total: daysInMonth(key), current: true };
}
