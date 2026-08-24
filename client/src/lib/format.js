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

export function compact(n) {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
  return inr0.format(v);
}

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
