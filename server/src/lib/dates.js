// Money tracking is date-only. Every date is stored at UTC midnight of the
// calendar day the user picked, so month/day math never drifts by timezone.
export function toDayUTC(input) {
  if (!input) return startOfToday();
  if (input instanceof Date) return new Date(Date.UTC(input.getFullYear(), input.getMonth(), input.getDate()));
  const m = String(input).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const d = new Date(input);
  if (Number.isNaN(d.valueOf())) return startOfToday();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function startOfToday() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

export const dayKey = (d) => new Date(d).toISOString().slice(0, 10);
export const monthKey = (d) => new Date(d).toISOString().slice(0, 7);

// "2026-08" -> [2026-08-01, 2026-09-01)
export function monthRange(month) {
  const m = String(month || '').match(/^(\d{4})-(\d{2})$/);
  const base = m ? new Date(Date.UTC(+m[1], +m[2] - 1, 1)) : (() => {
    const t = startOfToday();
    return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
  })();
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
  return { start: base, end, key: monthKey(base) };
}

// The n most recent month keys, oldest first, ending with `month`.
export function lastMonths(month, n) {
  const { start } = monthRange(month);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(monthKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - i, 1))));
  }
  return out;
}
