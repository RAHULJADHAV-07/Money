import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApi, useStore } from '../lib/store.jsx';
import { money, dayLabel } from '../lib/format.js';
import { hueFor, softFor, personInitials } from '../lib/palette.js';
import Sheet from '../components/Sheet.jsx';
import TxList from '../components/TxList.jsx';
import { IconChevronRight, IconDebt } from '../components/Icons.jsx';

function Avatar({ name, size = 'md' }) {
  return (
    <span
      className={`avatar avatar--${size}`}
      style={{ background: softFor(name), color: hueFor(name) }}
      aria-hidden="true"
    >
      {personInitials(name)}
    </span>
  );
}

function PersonSheet({ name, onClose }) {
  const { currency, openAdd } = useStore();
  const { data } = useApi(() => api.person(name), [name]);
  const items = data?.items || [];

  const sum = (kind) => items.filter((t) => t.kind === kind).reduce((n, t) => n + t.amount, 0);
  const lent = sum('lent');
  const back = sum('repay_received');
  const waived = sum('settle_received');
  const borrowed = sum('borrowed');
  const paid = sum('repay_paid');
  const forgiven = sum('settle_paid');
  const net = (lent - back - waived) - (borrowed - paid - forgiven);
  const owed = Math.abs(net);

  const breakdown = [
    ['You lent', lent], ['Got back', back], ['Waived off', waived],
    ['You borrowed', borrowed], ['You repaid', paid], ['They forgave', forgiven],
  ].filter(([, v]) => v > 0);

  const footer = net === 0 ? (
    <div className="btn-row">
      <button className="btn btn--block" onClick={() => { onClose(); openAdd({ kind: 'lent', person: name }); }}>Lend</button>
      <button className="btn btn--block" onClick={() => { onClose(); openAdd({ kind: 'borrowed', person: name }); }}>Borrow</button>
    </div>
  ) : (
    <div className="btn-row">
      <button className="btn btn--primary btn--block" onClick={() => {
        onClose();
        openAdd({ kind: net > 0 ? 'repay_received' : 'repay_paid', person: name, amount: owed });
      }}>
        {net > 0 ? `Got ${money(owed, currency)} back` : `Pay ${money(owed, currency)} back`}
      </button>
    </div>
  );

  return (
    <Sheet title={name} subtitle={`${items.length} ${items.length === 1 ? 'entry' : 'entries'}`} onClose={onClose} footer={footer}>
      <div className={`balance-card ${net >= 0 ? 'is-in' : 'is-out'}`}>
        <Avatar name={name} size="lg" />
        <div className="balance-card-text">
          <span className="k">{net === 0 ? 'All settled up' : net > 0 ? 'They still owe you' : 'You still owe them'}</span>
          <span className={`v num ${net >= 0 ? 'tone-text-in' : 'tone-text-out'}`}>{money(owed, currency)}</span>
        </div>
      </div>

      {breakdown.length > 0 && (
        <div className="kv-grid">
          {breakdown.map(([label, value]) => (
            <div className="kv" key={label}>
              <span className="kv-k">{label}</span>
              <span className="kv-v num">{money(value, currency)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn btn--block btn--sm" onClick={() => { onClose(); openAdd({ kind: 'lent', person: name }); }}>Lend more</button>
        <button className="btn btn--block btn--sm" onClick={() => { onClose(); openAdd({ kind: 'borrowed', person: name }); }}>Borrow more</button>
      </div>

      {owed > 0 && (
        <>
          <button
            className="btn btn--block btn--sm" style={{ marginTop: 8 }}
            onClick={() => {
              onClose();
              openAdd({
                kind: net > 0 ? 'settle_received' : 'settle_paid',
                person: name, amount: owed, note: 'Settled by agreement',
              });
            }}
          >
            Settle without payment
          </button>
          <p className="hint hint--center">
            Clears the remaining {money(owed, currency)} without any money moving.
          </p>
        </>
      )}

      <div className="section-label">History</div>
      <div className="card card--flush">
        {items.length
          ? <TxList items={items} showDays={false} onPick={(tx) => { onClose(); openAdd({ tx }); }} />
          : <div className="empty empty--sm"><div className="empty-t">Nothing yet</div></div>}
      </div>
    </Sheet>
  );
}

export default function People() {
  const { currency, openAdd } = useStore();
  const [open, setOpen] = useState(null);
  const { data, loading } = useApi(() => api.people(), []);

  const people = data?.people || [];
  const totals = data?.totals || { toReceive: 0, toPay: 0 };
  const active = people.filter((p) => !p.settled);
  const settled = people.filter((p) => p.settled);
  const net = totals.toReceive - totals.toPay;
  const scale = Math.max(totals.toReceive, totals.toPay, 1);

  return (
    <div className="page">
      <div className="card" data-tour="people">
        <div className="card-head">
          <h2 className="card-title">Your position</h2>
          <span className={`badge ${net >= 0 ? 'badge--in' : 'badge--out'}`}>
            {net >= 0 ? 'ahead by' : 'behind by'} {money(Math.abs(net), currency)}
          </span>
        </div>

        <div className="flow">
          <button className="flow-line flow-line--tap" onClick={() => openAdd({ kind: 'lent' })}>
            <span className="flow-k">To receive</span>
            <span className="flow-track">
              <i className="flow-fill tone-bg-in" style={{ width: `${Math.max(totals.toReceive > 0 ? 4 : 0, (totals.toReceive / scale) * 100)}%` }} />
            </span>
            <span className="flow-v num tone-text-in">{money(totals.toReceive, currency)}</span>
          </button>
          <button className="flow-line flow-line--tap" onClick={() => openAdd({ kind: 'borrowed' })}>
            <span className="flow-k">To pay back</span>
            <span className="flow-track">
              <i className="flow-fill tone-bg-out" style={{ width: `${Math.max(totals.toPay > 0 ? 4 : 0, (totals.toPay / scale) * 100)}%` }} />
            </span>
            <span className="flow-v num tone-text-out">{money(totals.toPay, currency)}</span>
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="card card--flush" style={{ marginTop: 14 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel-row">
              <div className="skel" style={{ width: 44, height: 44, borderRadius: 999 }} />
              <div style={{ flex: 1 }}>
                <div className="skel" style={{ height: 12, width: '44%', borderRadius: 6 }} />
                <div className="skel" style={{ height: 10, width: '28%', borderRadius: 6, marginTop: 8 }} />
              </div>
              <div className="skel" style={{ height: 14, width: 66, borderRadius: 6 }} />
            </div>
          ))}
        </div>
      ) : !people.length ? (
        <div className="empty">
          <div className="empty-ico"><IconDebt /></div>
          <div className="empty-t">No borrowing or lending yet</div>
          <div className="empty-s">Record money you lend to someone, or borrow from them, and the running balance stays here.</div>
          <div className="btn-row" style={{ marginTop: 16, justifyContent: 'center' }}>
            <button className="btn btn--primary" onClick={() => openAdd({ kind: 'lent' })}>I lent money</button>
            <button className="btn" onClick={() => openAdd({ kind: 'borrowed' })}>I borrowed</button>
          </div>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <div className="section-label">Open<span className="section-count">{active.length}</span></div>
              <div className="card card--flush">
                {active.map((p) => (
                  <button className="row" key={p.person} onClick={() => setOpen(p.person)}>
                    <Avatar name={p.person} />
                    <span className="row-body">
                      <span className="row-title">{p.person}</span>
                      <span className="row-meta">
                        {p.net > 0 ? 'owes you' : 'you owe'} · {dayLabel(p.lastActivity).toLowerCase()} · {p.entries} {p.entries === 1 ? 'entry' : 'entries'}
                      </span>
                    </span>
                    <span className="row-tail">
                      <span className={`row-amt num ${p.net > 0 ? 'tone-text-in' : 'tone-text-out'}`}>
                        {money(Math.abs(p.net), currency)}
                      </span>
                    </span>
                    <span className="row-chev" aria-hidden="true"><IconChevronRight /></span>
                  </button>
                ))}
              </div>
            </>
          )}

          {settled.length > 0 && (
            <>
              <div className="section-label">Settled<span className="section-count">{settled.length}</span></div>
              <div className="card card--flush is-quiet">
                {settled.map((p) => (
                  <button className="row" key={p.person} onClick={() => setOpen(p.person)}>
                    <Avatar name={p.person} />
                    <span className="row-body">
                      <span className="row-title">{p.person}</span>
                      <span className="row-meta">all settled up</span>
                    </span>
                    <span className="row-tail">
                      <span className="row-amt num dim">{money(0, currency)}</span>
                    </span>
                    <span className="row-chev" aria-hidden="true"><IconChevronRight /></span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {open && <PersonSheet name={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
