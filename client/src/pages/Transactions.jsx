import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, pendingWrites } from '../lib/api.js';
import { useApi, useStore } from '../lib/store.jsx';
import { money, moneyRound, monthLabel, dayLabel, dateShort, fullDayLabel, todayKey, shiftMonth } from '../lib/format.js';
import { IconSearch, IconClose, IconChevronRight, IconInbox } from '../components/Icons.jsx';
import { FlowBar } from '../components/Charts.jsx';
import TxList from '../components/TxList.jsx';
import { KINDS } from '../lib/kinds.js';
import { cycleOfMonth, currentCycle, cashFlow, moneyWallets, cardNames } from '../lib/credit.js';

/* Every kind, not a handful of bundles. The old chips grouped them — "Borrow /
   Lend" meant four kinds at once — which made it impossible to ask for just the
   money you borrowed. One kind per option answers the question you actually
   have; the two lists narrow independently. */
const TYPES = [
  'expense', 'income', 'refund', 'lent', 'borrowed', 'repay_received', 'repay_paid',
  'transfer', 'saving_in', 'saving_out', 'settle_received', 'settle_paid', 'pass_through',
];

export default function Transactions() {
  const { month, setMonth, currency, openAdd, openMonthSheet, day, settings, allTime, showAllTime } = useStore();
  const [kind, setKind] = useState('');
  // A card's own sheet opens the ledger on that card: ?wallet=HDFC.
  const [params] = useSearchParams();
  const [method, setMethod] = useState(() => params.get('wallet') || '');
  const [q, setQ] = useState('');

  const realWallets = settings ? moneyWallets(settings) : ['Cash', 'UPI', 'Bank'];
  const cards = settings ? cardNames(settings) : [];

  /* What each wallet holds right now, so picking one answers "and how much is
     left in it?" without a trip to the dashboard. No deps: balances are
     all-time and never depend on the filters below. */
  const { data: walletData } = useApi(() => api.wallets(), []);
  const walletNamed = (name) => walletData?.wallets?.find((w) => w.name === name);
  const picked = method ? walletNamed(method) : null;
  // "All payment methods" is money you hold — the balance in hand. Never a card.
  const inHand = walletData?.wallets?.filter((w) => !w.credit).reduce((n, w) => n + w.balance, 0);

  /* A credit card lives by its billing cycle, not the calendar month: with a
     card picked, a month means that month's bill — the cycle its statement
     closes on. The period decides the card's spending; what is owed now
     belongs to no period, and is shown apart from it. */
  const terms = method ? settings?.creditCards?.[method] : null;
  const cycle = terms && !day && !allTime ? cycleOfMonth(month, terms.statementDay) : null;
  const period = day ? { from: day, to: day } : cycle ? { from: cycle.start, to: cycle.end } : allTime ? {} : null;
  const cardPeriod = useApi(
    () => (terms && period ? api.cardActivity(method, period.from, period.to) : Promise.resolve(null)),
    [method, !!terms, period?.from, period?.to],
  ).data;
  // The months the two quick periods point at: this cycle's bill and the last one.
  const thisBill = terms ? currentCycle(todayKey(), terms.statementDay).end.slice(0, 7) : null;
  const lastBill = thisBill ? shiftMonth(thisBill, -1) : null;

  const { data, loading } = useApi(
    () => api.transactions({
      limit: 300,
      ...(day ? { from: day, to: day } : cycle ? { from: cycle.start, to: cycle.end } : allTime ? {} : { month }),
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
  /* Real money in and out: a card purchase moved no cash, paying the card
     did. With a card picked the box shows the card's own figures instead. */
  const flow = cashFlow(items, cards);
  const filtered = !!kind || !!method || !!q || !!day || !allTime;
  const range = cycle ? `${dateShort(cycle.start)} – ${dateShort(cycle.end)}` : '';
  const count = data?.total ?? items.length;
  const periodName = day ? fullDayLabel(day) : cycle ? `${monthLabel(month)} statement` : allTime ? 'All time' : monthLabel(month);

  return (
    <div className="page">
      <div className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">{terms ? `${method} · ${periodName}` : periodName}</h2>
            <p className="card-sub">
              {cycle ? `${range} · closes ${dateShort(cycle.end)} · ` : ''}
              {count} {count === 1 ? 'entry' : 'entries'}
              {filtered ? ' matching' : ''}
              {data?.hasMore ? ` · showing the latest ${items.length}` : ''}
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
                : cycle ? `Showing the ${monthLabel(month)} statement period`
                : `Showing ${monthLabel(month)}`}
            </span>
            <span className="daybar-a">See all time</span>
          </button>
        )}

        {terms ? (
          <>
            {/* Statement periods, one tap each — a card is read by its cycle. */}
            <div className="chips chips--flush">
              <button type="button" className={`chip${!day && !allTime && month === thisBill ? ' is-on' : ''}`} onClick={() => setMonth(thisBill)}>This cycle</button>
              <button type="button" className={`chip${!day && !allTime && month === lastBill ? ' is-on' : ''}`} onClick={() => setMonth(lastBill)}>Last statement</button>
              <button type="button" className={`chip${allTime && !day ? ' is-on' : ''}`} onClick={showAllTime}>All time</button>
            </div>
            <div className="kv-grid">
              <div className="kv">
                <span className="kv-k">Card spending</span>
                <span className="kv-v num">{cardPeriod ? money(cardPeriod.spent, currency) : '…'}</span>
                <span className="kv-n">{cardPeriod?.refunds > 0 ? `after ${money(cardPeriod.refunds, currency)} refunded` : 'in this period'}</span>
              </div>
              <div className="kv">
                <span className="kv-k">Paid to card</span>
                <span className="kv-v num tone-text-in">{cardPeriod ? money(cardPeriod.paid, currency) : '…'}</span>
                <span className="kv-n">in this period</span>
              </div>
            </div>
            {picked?.credit && (
              <p className="cc-now">
                <span>Right now, whatever the period:</span>
                <b>{money(picked.outstanding ?? picked.owed, currency)} outstanding</b>
                {picked.available !== null && picked.available !== undefined && <b>{money(picked.available, currency)} available</b>}
              </p>
            )}
            {(kind || q) && <p className="hint">These totals cover every entry on {method} in the period, not only the ones your search or type filter shows.</p>}
          </>
        ) : (
          <FlowBar inAmount={flow.in} outAmount={flow.out} inLabel="Money in" outLabel="Money out" />
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
                on a narrow phone has no room for paise. A card shows what is
                owed on it now, which is not what was spent in the period. */}
            {picked?.credit ? (
              <span className="field-note">{money(picked.outstanding ?? picked.owed, currency)} outstanding</span>
            ) : method && picked ? (
              <span className={`field-note${picked.balance < 0 ? ' field-note--neg' : ''}`}>{money(picked.balance, currency)}</span>
            ) : !method && inHand !== undefined ? (
              <span className="field-note">{money(inHand, currency)} in hand</span>
            ) : null}
          </label>
          <select id="f-method" className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">All payment methods</option>
            <optgroup label="Money">
              {realWallets.map((m) => {
                const w = walletNamed(m);
                return <option key={m} value={m}>{w ? `${m} · ${moneyRound(w.balance, currency)}` : m}</option>;
              })}
            </optgroup>
            {cards.length > 0 && (
              <optgroup label="Credit cards">
                {cards.map((m) => {
                  const w = walletNamed(m);
                  return (
                    <option key={m} value={m}>
                      {`Credit card — ${m}${w ? ` · ${moneyRound(w.outstanding ?? w.owed, currency)} outstanding` : ''}`}
                    </option>
                  );
                })}
              </optgroup>
            )}
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
                `${day ? ` on ${dayLabel(day)}` : cycle ? ` in the ${monthLabel(month)} statement period (${range})` : allTime ? ' yet' : ` in ${monthLabel(month)}`}.`}
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
          {terms
            ? (cardPeriod ? `${money(cardPeriod.spent, currency)} card spending · ${money(cardPeriod.paid, currency)} paid to card` : '')
            : `${money(flow.in, currency)} money in · ${money(flow.out, currency)} money out`}
        </p>
      )}
    </div>
  );
}
