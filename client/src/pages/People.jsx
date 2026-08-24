import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApi, useStore } from '../lib/store.jsx';
import { money, dayLabel } from '../lib/format.js';
import Sheet from '../components/Sheet.jsx';
import TxList from '../components/TxList.jsx';

const initials = (name) => name.split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function PersonSheet({ name, onClose }) {
  const { currency, openAdd } = useStore();
  const { data } = useApi(() => api.person(name), [name]);
  const items = data?.items || [];

  const lent = items.filter((t) => t.kind === 'lent').reduce((n, t) => n + t.amount, 0);
  const back = items.filter((t) => t.kind === 'repay_received').reduce((n, t) => n + t.amount, 0);
  const borrowed = items.filter((t) => t.kind === 'borrowed').reduce((n, t) => n + t.amount, 0);
  const paid = items.filter((t) => t.kind === 'repay_paid').reduce((n, t) => n + t.amount, 0);
  const net = (lent - back) - (borrowed - paid);

  return (
    <Sheet title={name} onClose={onClose}>
      <div className="card" style={{ marginTop: 0 }}>
        <div className="strip">
          <span className="k">{net >= 0 ? 'They still owe you' : 'You still owe them'}</span>
          <span className="v tabular" style={{ color: net >= 0 ? 'var(--in)' : 'var(--out)', fontSize: 16 }}>
            {money(Math.abs(net), currency)}
          </span>
        </div>
        {lent > 0 && <div className="strip"><span className="k muted">You lent</span><span className="v tabular">{money(lent, currency)}</span></div>}
        {back > 0 && <div className="strip"><span className="k muted">Got back</span><span className="v tabular">{money(back, currency)}</span></div>}
        {borrowed > 0 && <div className="strip"><span className="k muted">You borrowed</span><span className="v tabular">{money(borrowed, currency)}</span></div>}
        {paid > 0 && <div className="strip"><span className="k muted">You repaid</span><span className="v tabular">{money(paid, currency)}</span></div>}
      </div>

      <div className="btn-row" style={{ marginTop: 12 }}>
        {net > 0 && (
          <button className="btn btn-in btn-block" onClick={() => { onClose(); openAdd({ kind: 'repay_received', person: name }); }}>
            Got money back
          </button>
        )}
        {net < 0 && (
          <button className="btn btn-primary btn-block" onClick={() => { onClose(); openAdd({ kind: 'repay_paid', person: name }); }}>
            Pay them back
          </button>
        )}
      </div>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn btn-block btn-sm" onClick={() => { onClose(); openAdd({ kind: 'lent', person: name }); }}>Lend more</button>
        <button className="btn btn-block btn-sm" onClick={() => { onClose(); openAdd({ kind: 'borrowed', person: name }); }}>Borrow more</button>
      </div>

      <div className="card">
        <div className="card-head"><h2>History</h2></div>
        <TxList items={items} showDays={false} onPick={(tx) => { onClose(); openAdd({ tx }); }} />
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

  return (
    <div className="page">
      <div className="tiles" style={{ marginTop: 16 }}>
        <button className="tile" onClick={() => openAdd({ kind: 'lent' })}>
          <div className="k"><i className="dot in" />To receive</div>
          <div className="v in tabular">{money(totals.toReceive, currency)}</div>
          <div className="note">tap to lend more</div>
        </button>
        <button className="tile" onClick={() => openAdd({ kind: 'borrowed' })}>
          <div className="k"><i className="dot out" />To pay back</div>
          <div className="v out tabular">{money(totals.toPay, currency)}</div>
          <div className="note">tap to borrow</div>
        </button>
      </div>

      {loading && !data ? (
        <div style={{ marginTop: 18 }}>
          {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 66, marginBottom: 8 }} />)}
        </div>
      ) : !people.length ? (
        <div className="empty">
          <div className="big">⇄</div>
          <div className="t">No borrowing or lending yet</div>
          <div className="s">Record money you lend to someone, or borrow from them, and the running balance stays here.</div>
          <div className="btn-row" style={{ marginTop: 14, justifyContent: 'center' }}>
            <button className="btn btn-sm" onClick={() => openAdd({ kind: 'lent' })}>I lent money</button>
            <button className="btn btn-sm" onClick={() => openAdd({ kind: 'borrowed' })}>I borrowed</button>
          </div>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <>
              <div className="day-head"><span className="d">Open</span><span className="t">{active.length}</span></div>
              {active.map((p) => (
                <button className="person" key={p.person} onClick={() => setOpen(p.person)}>
                  <span className={`avatar ${p.net > 0 ? 'in' : 'out'}`}>{initials(p.person)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="person-name">{p.person}</span>
                    <span className="person-meta">
                      {p.net > 0 ? 'owes you' : 'you owe'} · {dayLabel(p.lastActivity).toLowerCase()}
                    </span>
                  </span>
                  <span className="person-amt">
                    <span className="n tabular" style={{ color: p.net > 0 ? 'var(--in)' : 'var(--out)' }}>
                      {money(Math.abs(p.net), currency)}
                    </span>
                    <span className="l">{p.entries} {p.entries === 1 ? 'entry' : 'entries'}</span>
                  </span>
                </button>
              ))}
            </>
          )}

          {settled.length > 0 && (
            <>
              <div className="day-head"><span className="d">Settled</span><span className="t">{settled.length}</span></div>
              {settled.map((p) => (
                <button className="person" key={p.person} onClick={() => setOpen(p.person)} style={{ opacity: .68 }}>
                  <span className="avatar">{initials(p.person)}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="person-name">{p.person}</span>
                    <span className="person-meta">all settled up</span>
                  </span>
                  <span className="person-amt"><span className="n muted tabular">{money(0, currency)}</span></span>
                </button>
              ))}
            </>
          )}
        </>
      )}

      {open && <PersonSheet name={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
