import { useState } from 'react';
import { api, pendingWrites } from '../lib/api.js';
import { useApi, useStore } from '../lib/store.jsx';
import { money, monthLabel, shiftMonth, monthKeyNow } from '../lib/format.js';
import TxList from '../components/TxList.jsx';

const FILTERS = [
  { id: 'all', label: 'All', kinds: '' },
  { id: 'out', label: 'Spent', kinds: 'expense' },
  { id: 'in', label: 'Received', kinds: 'income,repay_received' },
  { id: 'debt', label: 'Borrow / Lend', kinds: 'lent,borrowed,repay_paid,repay_received' },
  { id: 'save', label: 'Savings', kinds: 'saving_in,saving_out' },
];

export default function Transactions() {
  const { month, setMonth, currency, openAdd } = useStore();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');

  const active = FILTERS.find((f) => f.id === filter);
  const { data, loading } = useApi(
    () => api.transactions({ month, limit: 300, ...(active.kinds && { kinds: active.kinds }), ...(q && { q }) }),
    [month, filter, q]
  );

  // Entries saved while offline aren't on the server yet — show them inline.
  const queued = pendingWrites()
    .filter((w) => w.method === 'POST' && w.path === '/transactions')
    .map((w) => ({ ...w.body, _id: w.id, queued: true, goal: null }));

  const items = [...queued, ...(data?.items || [])];
  const spent = items.filter((t) => t.kind === 'expense').reduce((n, t) => n + t.amount, 0);
  const got = items.filter((t) => t.kind === 'income' || t.kind === 'repay_received').reduce((n, t) => n + t.amount, 0);

  return (
    <div className="page">
      <div className="card" style={{ marginTop: 16 }}>
        <div className="month-nav" style={{ justifyContent: 'space-between' }}>
          <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
          <span className="label" style={{ flex: 1, fontSize: 14 }}>{monthLabel(month)}</span>
          <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= monthKeyNow()} aria-label="Next month">›</button>
        </div>
        <div className="divider" />
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div className="k" style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>Money out</div>
            <div className="tabular" style={{ fontSize: 18, fontWeight: 700, color: 'var(--out)', marginTop: 3 }}>
              {money(spent, currency)}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="k" style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>Money in</div>
            <div className="tabular" style={{ fontSize: 18, fontWeight: 700, color: 'var(--in)', marginTop: 3 }}>
              {money(got, currency)}
            </div>
          </div>
        </div>
      </div>

      <input
        className="input" style={{ marginTop: 12 }} placeholder="Search notes, people, categories…"
        value={q} onChange={(e) => setQ(e.target.value)}
      />

      <div className="chips" style={{ marginTop: 10 }}>
        {FILTERS.map((f) => (
          <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div style={{ marginTop: 16 }}>
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 62, marginBottom: 7 }} />)}
        </div>
      ) : items.length ? (
        <div style={{ marginTop: 4 }}>
          <TxList items={items} onPick={(tx) => !tx.queued && openAdd({ tx })} />
        </div>
      ) : (
        <div className="empty">
          <div className="big">⌕</div>
          <div className="t">Nothing here</div>
          <div className="s">{q ? 'No entry matches that search.' : `No ${active.label.toLowerCase()} entries in ${monthLabel(month)}.`}</div>
        </div>
      )}
    </div>
  );
}
