import { useState } from 'react';
import { KINDS, partTotals } from '../lib/kinds.js';
import { KindIcon, IconChevronRight, IconSplit } from './Icons.jsx';
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

export function TxRow({ tx, onClick, nested = false }) {
  const { currency } = useStore();
  const k = KINDS[tx.kind] || {};
  const tone = k.tone || 'out';
  const sign = k.dir > 0 ? '+' : k.dir < 0 ? '−' : '';

  return (
    <button className={`row${nested ? ' row--nested' : ''}${tx.queued ? ' row--queued' : ''}`} onClick={onClick} type="button">
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

/* A split shows as the one thing that happened, with its parts tucked underneath.
   Collapsed it reads as a single event; open, it shows what each piece of the
   money really was — which is the reason for splitting it in the first place. */
function GroupRow({ group, parts, onOpen }) {
  const { currency } = useStore();
  /* A filtered view — one person's history, say — reaches only the parts that
     match it. The parts that are here are checked against what the split says
     changed hands: if they do not add up, this is a window onto a split rather
     than the whole of it, and it must not claim otherwise. */
  const tally = partTotals(parts);
  const whole =
    Math.abs(tally.in - (group.received || 0)) < 0.005 &&
    Math.abs(tally.out - (group.paid || 0)) < 0.005;
  const [open, setOpen] = useState(!whole);
  /* The figure the event actually had -- the bill, or the amount handed over --
     rather than either side of the ledger it turned into. A bill someone else
     paid moves none of your cash, but it was still a bill for that much. */
  const headline = whole
    ? (group.total || Math.max(group.received || 0, group.paid || 0))
    : Math.max(tally.in, tally.out);

  return (
    <div className={`grouprow${open ? ' grouprow--open' : ''}`}>
      <button className="row row--group" onClick={() => setOpen((v) => !v)} type="button" aria-expanded={open}>
        <span className="row-ico tone-flat" aria-hidden="true"><IconSplit /></span>
        <span className="row-body">
          <span className="row-title">{group.title || 'Split entry'}</span>
          <span className="row-meta">
            {whole
              ? `Split · ${parts.length} ${parts.length === 1 ? 'part' : 'parts'}`
              : `From a split · ${parts.length} of its ${parts.length === 1 ? 'part' : 'parts'} shown here`}
          </span>
        </span>
        <span className="row-tail">
          <span className="row-amt row-amt--tx num">{money(headline, currency)}</span>
        </span>
        <span className={`row-chev row-chev--toggle${open ? ' is-open' : ''}`} aria-hidden="true"><IconChevronRight /></span>
      </button>

      {open && (
        <div className="group-parts">
          {/* A part cannot be edited alone — its amount is half of an arithmetic
              the whole split has to satisfy — so tapping one opens the split. */}
          {parts.map((p) => <TxRow key={p._id} tx={p} nested onClick={() => onOpen?.(group._id)} />)}
          <button className="group-edit" type="button" onClick={() => onOpen?.(group._id)}>Edit this split</button>
        </div>
      )}
    </div>
  );
}

/* Parts arrive as ordinary rows — the ledger is what folds them back together.
   A group takes the position of its first part, so the day's order is unchanged. */
function fold(items) {
  const out = [];
  const seen = new Map();
  for (const t of items) {
    const g = t.group;
    if (!g?._id) { out.push({ type: 'tx', tx: t }); continue; }
    const at = seen.get(g._id);
    if (at === undefined) {
      seen.set(g._id, out.length);
      out.push({ type: 'group', group: g, parts: [t] });
    } else {
      out[at].parts.push(t);
    }
  }
  return out;
}

export default function TxList({ items, onPick, showDays = true }) {
  const { currency, openSplit } = useStore();
  if (!items?.length) return null;

  const render = (list) =>
    fold(list).map((node) =>
      node.type === 'group'
        ? <GroupRow key={node.group._id} group={node.group} parts={node.parts} onOpen={(id) => openSplit({ groupId: id })} />
        : <TxRow key={node.tx._id || node.tx.id} tx={node.tx} onClick={() => onPick?.(node.tx)} />
    );

  if (!showDays) return <div className="list">{render(items)}</div>;

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
        <div className="list">{render(day.items)}</div>
      </section>
    );
  });
}
