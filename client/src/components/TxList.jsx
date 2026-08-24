import { KINDS } from '../lib/kinds.js';
import { money, dayLabel, dayOf } from '../lib/format.js';
import { useStore } from '../lib/store.jsx';

export function txTitle(t) {
  if (t.note) return t.note;
  if (t.kind === 'expense') return t.category || 'Expense';
  if (t.kind === 'income') return t.source || 'Income';
  if (t.person) return t.person;
  return t.goal?.name || 'Savings';
}

function txMeta(t) {
  const k = KINDS[t.kind];
  const bits = [k?.short];
  if (t.note) {
    if (t.category) bits.push(t.category);
    else if (t.source) bits.push(t.source);
    else if (t.person) bits.push(t.person);
    else if (t.goal?.name) bits.push(t.goal.name);
  }
  if (t.method && t.method !== 'Cash') bits.push(t.method);
  return bits.filter(Boolean).join(' · ');
}

export function TxRow({ tx, onClick }) {
  const { currency } = useStore();
  const k = KINDS[tx.kind] || {};
  const tone = k.tone || 'out';
  const sign = k.dir > 0 ? '+' : '−';

  return (
    <button className={`tx ${tx.queued ? 'queued' : ''}`} onClick={onClick}>
      <span className={`tx-icon ${tone}`} aria-hidden="true">{k.icon}</span>
      <span className="tx-body">
        <span className="tx-title">{txTitle(tx)}</span>
        <span className="tx-meta">{tx.queued ? 'Waiting to sync · ' : ''}{txMeta(tx)}</span>
      </span>
      <span className={`tx-amt ${tone} tabular`}>{sign}{money(tx.amount, currency).replace('-', '')}</span>
    </button>
  );
}

// Groups a flat list into day sections with a per-day net figure.
export default function TxList({ items, onPick, showDays = true }) {
  const { currency } = useStore();
  if (!items?.length) return null;

  if (!showDays) {
    return items.map((t) => <TxRow key={t._id || t.id} tx={t} onClick={() => onPick?.(t)} />);
  }

  const days = [];
  for (const t of items) {
    const key = dayOf(t.date);
    if (!days.length || days.at(-1).key !== key) days.push({ key, items: [] });
    days.at(-1).items.push(t);
  }

  return days.map((day) => {
    const net = day.items.reduce((n, t) => n + (KINDS[t.kind]?.dir ?? 0) * t.amount, 0);
    return (
      <section key={day.key}>
        <header className="day-head">
          <span className="d">{dayLabel(day.key)}</span>
          <span className="t" style={{ color: net >= 0 ? 'var(--in)' : undefined }}>
            {net >= 0 ? '+' : '−'}{money(Math.abs(net), currency)}
          </span>
        </header>
        {day.items.map((t) => <TxRow key={t._id || t.id} tx={t} onClick={() => onPick?.(t)} />)}
      </section>
    );
  });
}
