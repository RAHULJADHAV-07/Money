import { KINDS } from '../lib/kinds.js';
import { KindIcon, IconChevronRight } from './Icons.jsx';
import { money, dayLabel, dayOf, weekdayLabel } from '../lib/format.js';
import { useStore } from '../lib/store.jsx';

export function txTitle(t) {
  if (t.kind === 'transfer') return t.note || `${t.method} → ${t.toMethod}`;
  if (t.note) return t.note;
  if (t.kind === 'expense') return t.category || 'Expense';
  if (t.kind === 'income') return t.source || 'Income';
  if (t.person) return t.person;
  return t.goal?.name || 'Savings';
}

function txMeta(t) {
  const k = KINDS[t.kind];
  const bits = [k?.short];
  if (t.kind === 'transfer') {
    bits.push(`${t.method} → ${t.toMethod}`);
    return bits.filter(Boolean).join(' · ');
  }
  if (t.note) {
    if (t.category) bits.push(t.category);
    else if (t.source) bits.push(t.source);
    else if (t.person) bits.push(t.person);
    else if (t.goal?.name) bits.push(t.goal.name);
  }
  // Now that wallets are tracked, every cash-moving row names its wallet — hiding
  // the default one made otherwise identical rows look inconsistent.
  // Settlements move no money, so naming a wallet there would be misleading.
  if (t.method && k?.dir !== 0) bits.push(t.method);
  return bits.filter(Boolean).join(' · ');
}

export function TxRow({ tx, onClick }) {
  const { currency } = useStore();
  const k = KINDS[tx.kind] || {};
  const tone = k.tone || 'out';
  const sign = k.dir > 0 ? '+' : k.dir < 0 ? '−' : '';

  return (
    <button className={`row${tx.queued ? ' row--queued' : ''}`} onClick={onClick} type="button">
      <span className={`row-ico tone-${tone}`} aria-hidden="true"><KindIcon kind={tx.kind} /></span>
      <span className="row-body">
        <span className="row-title">{txTitle(tx)}</span>
        <span className="row-meta">
          {tx.queued && <span className="row-flag">waiting to sync</span>}
          {txMeta(tx)}
        </span>
      </span>
      <span className="row-tail">
        <span className={`row-amt row-amt--tx num tone-text-${tone}`}>{sign}{money(tx.amount, currency).replace('-', '')}</span>
      </span>
      <span className="row-chev" aria-hidden="true"><IconChevronRight /></span>
    </button>
  );
}

/* Groups a flat list into day sections with a per-day net figure. Rows live
   inside one panel with hairline separators rather than as separate cards —
   a long ledger reads as a single column that way instead of a stack of tiles. */
export default function TxList({ items, onPick, showDays = true }) {
  const { currency } = useStore();
  if (!items?.length) return null;

  if (!showDays) {
    return (
      <div className="list">
        {items.map((t) => <TxRow key={t._id || t.id} tx={t} onClick={() => onPick?.(t)} />)}
      </div>
    );
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
      <section className="day-section" key={day.key}>
        <header className="day-head">
          <span className="day-head-l">
            <span className="d">{dayLabel(day.key)}</span>
            <span className="w">{weekdayLabel(day.key)}</span>
          </span>
          <span className={`day-head-net num ${net >= 0 ? 'tone-text-in' : ''}`}>
            {net >= 0 ? '+' : '−'}{money(Math.abs(net), currency)}
          </span>
        </header>
        <div className="list">
          {day.items.map((t) => <TxRow key={t._id || t.id} tx={t} onClick={() => onPick?.(t)} />)}
        </div>
      </section>
    );
  });
}
