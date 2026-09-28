import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, pendingWrites } from '../lib/api.js';
import { useApi, useStore } from '../lib/store.jsx';
import { money, moneyRound, monthLabel, dayLabel, fullDayLabel, todayKey } from '../lib/format.js';
import { IconSearch, IconClose, IconChevronRight, IconInbox } from '../components/Icons.jsx';
import { FlowBar } from '../components/Charts.jsx';
import TxList from '../components/TxList.jsx';
import { KINDS, dirOf } from '../lib/kinds.js';
import { cycleOfMonth, currentCycle, cardFlow } from '../lib/credit.js';

/* Every kind, not a handful of bundles. The old chips grouped them — "Borrow /
   Lend" meant four kinds at once — which made it impossible to ask for just the
   money you borrowed. One kind per option answers the question you actually
   have; the two lists narrow independently. */
const TYPES = [
  'expense', 'income', 'lent', 'borrowed', 'repay_received', 'repay_paid',
  'transfer', 'saving_in', 'saving_out', 'settle_received', 'settle_paid', 'pass_through',
];

export default function Transactions() {
  const { month, currency, openAdd, openMonthSheet, day, settings, allTime, showAllTime } = useStore();
  const [kind, setKind] = useState('');
  // A card's own sheet opens the ledger on that card: ?wallet=HDFC.
  const [params] = useSearchParams();
  const [method, setMethod] = useState(() => params.get('wallet') || '');
  const [q, setQ] = useState('');

  const wallets = settings?.methods?.length ? settings.methods : ['Cash', 'UPI', 'Bank', 'Card'];

  /* What each wallet holds right now, so picking one answers "and how much is
     left in it?" without a trip to the dashboard. The same endpoint the add
     sheet uses, and it re-runs on every write, so the figures never go stale.
     No deps: balances are all-time and never depend on the filters below. */
  const { data: walletData } = useApi(() => api.wallets(), []);
  const walletNamed = (name) => walletData?.wallets?.find((w) => w.name === name);
  const balanceOf = (name) => walletNamed(name)?.balance;
  /* One wallet shows its own balance; "All wallets" shows the cash they hold,
     which is the same figure the dashboard calls the balance. A credit card
     says what is owed on it instead — it is the bank's money, not yours. */
  const picked = method ? walletNamed(method) : null;
  const shown = method
    ? balanceOf(method)
    : walletData?.wallets?.filter((w) => !w.credit).reduce((n, w) => n + w.balance, 0);

  /* A credit card lives by its billing cycle, not the calendar month. With a
     card picked, "all time" still lists everything but the totals are this
     cycle's, back to zero the day after each statement; picking a month means
     that month's bill — the cycle its statement closes — for the list too. */
  const terms = method ? settings?.creditCards?.[method] : null;
  const cycle = terms && !day
    ? (allTime ? currentCycle(todayKey(), terms.statementDay) : cycleOfMonth(month, terms.statementDay))
    : null;
  const billView = !!cycle && !allTime;

  const { data, loading } = useApi(
    () => api.transactions({
      limit: 300,
      ...(day ? { from: day, to: day } : billView ? { from: cycle.start, to: cycle.end } : allTime ? {} : { month }),
      ...(kind && { kind }),
      ...(method && { method }),
      ...(q && { q }),
    }),
    [month, day, allTime, kind, method, q, cycle?.start, cycle?.end]
  );

  /* Entries saved while offline aren't on the server yet — show them inline. A
     queued split arrives as one write holding its parts; it is unpacked back
     into rows so the ledger can fold it the same way it folds a saved one. */
  const queued = pendingWrites()
    .filter((w) => w.method === 'POST' && (w.path === '/transactions' || w.path === '/transactions/group'))
    .flatMap((w) => {
      if (w.path === '/transactions') return [{ ...w.body, _id: w.id, queued: true, goal: null, group: null }];
      const group = { _id: w.id, title: w.body.title, received: w.body.received, paid: w.body.paid };
      return w.body.parts.map((p, i) => ({
        ...p, _id: `${w.id}-${i}`, date: w.body.date, queued: true, goal: null, group,
      }));
    })
    // The server applies the filters to everything else; these never reached it.
    .filter((t) => (!kind || t.kind === kind) && (!method || t.method === method || t.toMethod === method));

  const items = [...queued, ...(data?.items || [])];
  // On a card: only this cycle's entries count towards the bar, whatever is listed.
  const inCycle = cycle
    ? items.filter((t) => { const d = String(t.date).slice(0, 10); return d >= cycle.start && d <= cycle.end; })
    : items;
  const flow = cycle ? cardFlow(inCycle, method, dirOf) : null;
  const spent = flow ? flow.out : items.filter((t) => t.kind === 'expense').reduce((n, t) => n + t.amount, 0);
  const got = flow ? flow.in : items.filter((t) => t.kind === 'income' || t.kind === 'repay_received').reduce((n, t) => n + t.amount, 0);
  const filtered = !!kind || !!method || !!q || !!day || !allTime;
  const range = cycle ? `${dayLabel(cycle.start)} – ${dayLabel(cycle.end)}` : '';
  const count = data?.total ?? items.length;

  return (
    <div className="page">
      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">
              {day ? fullDayLabel(day)
                : cycle ? (billView ? `${monthLabel(month)} bill` : `${method} · this cycle`)
                : allTime ? 'All time' : monthLabel(month)}
            </h2>
            <p className="card-sub">
              {cycle ? (
                billView
                  ? `${range} · statement ${dayLabel(cycle.end)} · ${count} ${count === 1 ? 'entry' : 'entries'}`
                  : `${range} · resets after the ${dayLabel(cycle.end)} statement`
              ) : (
                <>
                  {count} {count === 1 ? 'entry' : 'entries'}
                  {filtered ? ' matching' : ''}
                  {data?.hasMore ? ` · showing the latest ${items.length}` : ''}
                </>
              )}
            </p>
          </div>
          <button className="card-action" onClick={openMonthSheet}>
            {allTime && !day ? 'Pick a month' : 'Change'}<IconChevronRight />
          </button>
        </div>

        {/* One way back out, whichever way you narrowed it. */}
        {(day || !allTime) && (
          <button className="daybar" onClick={showAllTime}>
            <span>
              {day ? `Showing ${fullDayLabel(day)}`
                : billView ? `Showing the ${monthLabel(month)} bill cycle`
                : `Showing ${monthLabel(month)}`}
            </span>
            <span className="daybar-a">See all time</span>
          </button>
        )}

        {cycle
          ? <FlowBar inAmount={got} outAmount={spent} inLabel="Paid" outLabel="Spent" />
          : <FlowBar inAmount={got} outAmount={spent} />}
        {cycle && !billView && (
          <p className="hint">{count} {count === 1 ? 'entry' : 'entries'} on {method} listed below, from all time.</p>
        )}
      </div>

      <div className="searchbar" data-tour="search">
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

      <div className="filters" data-tour="filters">
        <div className="field">
          <label className="field-label" htmlFor="f-kind">Type of entry</label>
          <select id="f-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All types</option>
            {TYPES.map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="f-method">
            Paid with
            {/* Exact beside the label, rounded inside the list — a dropdown row
                on a narrow phone has no room for paise. */}
            {shown !== undefined && (
              <span className={`field-note${shown < 0 && !picked?.credit ? ' field-note--neg' : ''}`}>
                {picked?.credit ? `${money(picked.owed, currency)} owed` : `${money(shown, currency)}${method ? '' : ' in all'}`}
              </span>
            )}
          </label>
          <select id="f-method" className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">All wallets</option>
            {wallets.map((m) => {
              const w = walletNamed(m);
              return (
                <option key={m} value={m}>
                  {!w ? m : w.credit ? `${m} · ${moneyRound(w.owed, currency)} owed` : `${m} · ${moneyRound(w.balance, currency)}`}
                </option>
              );
            })}
          </select>
        </div>
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
              : `No ${kind ? `${KINDS[kind].label.toLowerCase()} ` : ''}entries` +
                `${method ? ` in ${method}` : ''}` +
                `${day ? ` on ${dayLabel(day)}` : billView ? ` in the ${monthLabel(month)} bill cycle (${range})` : allTime ? ' yet' : ` in ${monthLabel(month)}`}.`}
          </div>
          {filtered ? (
            <button className="btn" style={{ marginTop: 16 }}
                    onClick={() => { setQ(''); setKind(''); setMethod(''); showAllTime(); }}>
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
          {cycle
            ? `${money(spent, currency)} spent · ${money(got, currency)} paid this ${billView ? 'bill cycle' : 'cycle'}`
            : `${money(got, currency)} in · ${money(spent, currency)} out`}
        </p>
      )}
    </div>
  );
}
