import { useState } from 'react';
import { api, pendingWrites } from '../lib/api.js';
import { useApi, useStore } from '../lib/store.jsx';
import { money, monthLabel, dayLabel, fullDayLabel } from '../lib/format.js';
import { IconSearch, IconClose, IconChevronRight, IconInbox } from '../components/Icons.jsx';
import { FlowBar } from '../components/Charts.jsx';
import TxList from '../components/TxList.jsx';

const FILTERS = [
  { id: 'all', label: 'All', kinds: '' },
  { id: 'out', label: 'Spent', kinds: 'expense' },
  { id: 'in', label: 'Received', kinds: 'income,repay_received' },
  { id: 'debt', label: 'Borrow / Lend', kinds: 'lent,borrowed,repay_paid,repay_received' },
  { id: 'save', label: 'Savings', kinds: 'saving_in,saving_out' },
  { id: 'move', label: 'Transfers', kinds: 'transfer' },
];

export default function Transactions() {
  const { month, currency, openAdd, openMonthSheet, day, setDay } = useStore();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const active = FILTERS.find((f) => f.id === filter);
  const { data, loading } = useApi(
    () => api.transactions({
      limit: 300,
      ...(day ? { from: day, to: day } : { month }),
      ...(active.kinds && { kinds: active.kinds }),
      ...(q && { q }),
    }),
    [month, day, filter, q]
  );

  // Entries saved while offline aren't on the server yet — show them inline.
  const queued = pendingWrites()
    .filter((w) => w.method === 'POST' && w.path === '/transactions')
    .map((w) => ({ ...w.body, _id: w.id, queued: true, goal: null }));

  const items = [...queued, ...(data?.items || [])];
  const spent = items.filter((t) => t.kind === 'expense').reduce((n, t) => n + t.amount, 0);
  const got = items.filter((t) => t.kind === 'income' || t.kind === 'repay_received').reduce((n, t) => n + t.amount, 0);
  const filtered = filter !== 'all' || !!q;

  return (
    <div className="page">
      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">{day ? fullDayLabel(day) : monthLabel(month)}</h2>
            <p className="card-sub">
              {items.length} {items.length === 1 ? 'entry' : 'entries'}{filtered ? ' matching' : ''}
            </p>
          </div>
          <button className="card-action" onClick={openMonthSheet}>Change<IconChevronRight /></button>
        </div>

        {day && (
          <button className="daybar" onClick={() => setDay(null)}>
            <span>Showing one day</span>
            <span className="daybar-a">See all of {monthLabel(month)}</span>
          </button>
        )}

        <FlowBar inAmount={got} outAmount={spent} />
      </div>

      <div className="searchbar">
        <IconSearch />
        <input
          className="searchbar-input"
          placeholder="Search notes, people, categories…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search entries"
        />
        {q && (
          <button className="searchbar-clear" onClick={() => setQ('')} aria-label="Clear search"><IconClose /></button>
        )}
      </div>

      <div className="chips">
        {FILTERS.map((f) => (
          <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>


      {loading && !data ? (
        <div className="card card--flush" style={{ marginTop: 14 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skel-row">
              <div className="skel" style={{ width: 42, height: 42, borderRadius: 14 }} />
              <div style={{ flex: 1 }}>
                <div className="skel" style={{ height: 12, width: '52%', borderRadius: 6 }} />
                <div className="skel" style={{ height: 10, width: '32%', borderRadius: 6, marginTop: 8 }} />
              </div>
              <div className="skel" style={{ height: 14, width: 62, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : items.length ? (
        <TxList items={items} onPick={(tx) => !tx.queued && openAdd({ tx })} />
      ) : (
        <div className="empty">
          <div className="empty-ico"><IconInbox /></div>
          <div className="empty-t">Nothing here</div>
          <div className="empty-s">
            {q
              ? `No entry matches “${q}”.`
              : `No ${active.label.toLowerCase()} entries ${day ? `on ${dayLabel(day)}` : `in ${monthLabel(month)}`}.`}
          </div>
          {filtered ? (
            <button className="btn" style={{ marginTop: 16 }} onClick={() => { setQ(''); setFilter('all'); }}>
              Clear filters
            </button>
          ) : (
            <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={() => openAdd({ kind: 'expense' })}>
              Add an entry
            </button>
          )}
        </div>
      )}

      {items.length > 0 && (
        <p className="list-foot num">
          {money(got, currency)} in · {money(spent, currency)} out
        </p>
      )}
    </div>
  );
}
