import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sheet from './Sheet.jsx';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { money as fmt, moneyRound, dateShort, pct } from '../lib/format.js';
import { walletHue } from '../lib/palette.js';
import { billLine, HISTORY_LABEL, utilTone, ordinal, renewalLine } from '../lib/credit.js';
import { IconCard, IconChevronRight, IconInfo } from './Icons.jsx';

export const cardColor = (card, order = []) => card.color || walletHue(card.name, order);

/* How much of the limit is in use. With no limit there is nothing to fill. */
export function UsageBar({ card, onDark = false }) {
  if (card.utilization === null || card.utilization === undefined) return null;
  const u = Math.min(1, card.utilization);
  return (
    <span className={`cc-bar${onDark ? ' cc-bar--dark' : ''}`} role="img"
          aria-label={`${Math.round(u * 100)}% of the credit limit used`}>
      <span className={`cc-bar-fill tone-bg-${utilTone(card.utilization)}`} style={{ width: `${Math.max(u * 100, u > 0 ? 3 : 0)}%` }} />
    </span>
  );
}

const Metric = ({ label, value, tone = '', note }) => (
  <div className="kv">
    <span className="kv-k">{label}</span>
    <span className={`kv-v num${tone ? ` tone-text-${tone}` : ''}`}>{value}</span>
    {note && <span className="kv-n">{note}</span>}
  </div>
);

/* A period of card activity: spending (net of refunds) and payments, never
   the outstanding — which belongs to no period. */
function ActivityGrid({ a, money }) {
  return (
    <div className="kv-grid">
      <Metric label="Card spending" value={money(a.spent)} />
      <Metric label="Paid to card" value={money(a.paid)} tone="in" />
      <Metric label="Purchases" value={money(a.purchases)} />
      <Metric label="Refunds" value={money(a.refunds)} />
    </div>
  );
}

function CustomPeriod({ card, money }) {
  const [from, setFrom] = useState(card.cycle.start);
  const [to, setTo] = useState(card.cycle.end);
  const [a, setA] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    setError('');
    api.cardActivity(card.name, from, to)
      .then((r) => alive && setA(r))
      .catch((e) => alive && (setA(null), setError(e.message)));
    return () => { alive = false; };
  }, [card.name, from, to]);
  return (
    <>
      <div className="row-2">
        <div className="field">
          <label className="field-label" htmlFor="cp-from">From</label>
          <input id="cp-from" className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="cp-to">To</label>
          <input id="cp-to" className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      {error && <p className="field-warn">{error}</p>}
      {a && <ActivityGrid a={a} money={money} />}
      {a && <p className="hint">{a.count} {a.count === 1 ? 'entry' : 'entries'} on {card.name} from {dateShort(from)} to {dateShort(to)}, both days included.</p>}
    </>
  );
}

/*
 * One credit card, the way a normal person asks about it: what did I spend
 * this cycle, what do I owe, how much can I still spend, when does the
 * statement close and when must I pay. The limit, the outstanding and the
 * spending are three different numbers and are never shown as one.
 */
export default function CardSheet({ card, onClose, onPay, onEdit }) {
  const { currency, settings } = useStore();
  const navigate = useNavigate();
  const money = (n) => fmt(n, currency);
  const [tab, setTab] = useState('statement');
  const st = card.statement;
  const line = billLine(st, money);
  const cyc = card.cycle;

  const goLedger = () => { onClose(); navigate(`/ledger?wallet=${encodeURIComponent(card.name)}`); };

  return (
    <Sheet title={card.name} subtitle={card.expired ? 'Credit card · expired' : 'Credit card'} onClose={onClose}>
      <div className="ccard ccard--big" style={{ '--wc': cardColor(card, settings?.methods || []) }}>
        <span className="ccard-top">
          <span className="wname">{card.name}</span>
          <span className="ccard-chip"><IconCard />{card.expired ? 'Expired' : 'Credit'}</span>
        </span>
        <span className="ccard-k">Current cycle</span>
        <span className="ccard-period">{dateShort(cyc.start)} – {dateShort(cyc.end)}</span>
        {card.limit > 0 && (
          <>
            <UsageBar card={card} onDark />
            <span className="ccard-foot num">
              <span>{money(card.outstanding)} used</span>
              <span>of {moneyRound(card.limit, currency)} limit</span>
            </span>
          </>
        )}
      </div>

      <div className="kv-grid">
        <Metric label="Spent this cycle" value={money(cyc.spent)} note={cyc.refunds > 0 ? `after ${money(cyc.refunds)} refunded` : null} />
        <Metric label="Paid this cycle" value={money(cyc.paid)} tone="in" />
        <Metric label="Outstanding" value={money(card.outstanding)} tone={card.outstanding > 0 ? 'out' : ''}
                note={card.inCredit > 0 ? `${money(card.inCredit)} in credit` : 'what you owe now'} />
        <Metric label="Available credit" value={card.available === null ? '—' : money(card.available)}
                note={card.limit > 0 ? `of ${moneyRound(card.limit, currency)}` : 'no limit set'} />
      </div>

      <div className="cc-dates">
        <div><span>Statement closes</span><b>{dateShort(cyc.end)}</b><i>{cyc.daysToClose === 0 ? 'today' : `in ${cyc.daysToClose} days`}</i></div>
        <div><span>Payment due</span><b>{cyc.dueDate ? dateShort(cyc.dueDate) : 'Not set'}</b><i>for this cycle</i></div>
      </div>

      <div className="btn-row cc-actions">
        <button className="btn btn--primary btn--block" onClick={onPay} disabled={card.outstanding <= 0.005}>Pay card</button>
        <button className="btn btn--block" onClick={onEdit}>Edit card</button>
      </div>

      <div className="seg" role="tablist" aria-label="Period">
        {[['statement', 'Last statement'], ['custom', 'Custom period'], ['all', 'All time']].map(([k, label]) => (
          <button key={k} type="button" role="tab" className="seg-btn" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'statement' && (
        <div className="cc-section cc-section--flush">
          <div className="cc-head">
            <h3 className="cc-title">{dateShort(st.cycleStart)} – {dateShort(st.date)}</h3>
            {line.badge && <span className={`badge badge--${line.tone}`}>{line.badge}</span>}
          </div>
          <p className={`cc-line tone-text-${line.tone}`}>{line.text}</p>
          <div className="kv-grid">
            <Metric label="Statement total" value={money(st.billed)} note="owed when it closed" />
            <Metric label="Spent in that cycle" value={money(st.spent)} />
            <Metric label="Paid since" value={money(st.paid)} tone="in" note="payments and refunds" />
            <Metric label="Remaining" value={money(st.remaining)} tone={st.remaining > 0 ? 'out' : ''} />
            <Metric label="Payment due" value={st.dueDate ? dateShort(st.dueDate) : 'Not set'} />
            {st.minDue !== null && <Metric label="Minimum due" value={money(st.minDue)} />}
          </div>
          {st.remaining > 0.005 && card.interestIfCarried > 0 && (
            <div className="note-box note-box--warn">
              <IconInfo />
              <span>
                Pay the full {money(st.remaining)}{st.dueDate ? ` by ${dateShort(st.dueDate)}` : ''} and there is no interest.
                Leave part of it and about {money(card.interestIfCarried)} a month is added at {card.apr}% a year.
              </span>
            </div>
          )}
        </div>
      )}
      {tab === 'custom' && <CustomPeriod card={card} money={money} />}
      {tab === 'all' && (
        <>
          <ActivityGrid a={card.allTime} money={money} />
          <p className="hint">
            Everything ever spent on {card.name}. What you owe now is {money(card.outstanding)} — worked out separately,
            from every purchase, refund and payment{card.inCredit > 0 ? '' : ' and the opening outstanding'}.
          </p>
        </>
      )}

      {card.history.length > 0 && (
        <div className="cc-section">
          <div className="cc-head"><h3 className="cc-title">Earlier statements</h3></div>
          {card.history.map((h) => {
            const [label, tone] = HISTORY_LABEL[h.status] || ['', 'flat'];
            return (
              <div key={h.date} className="cc-hist">
                <span className="cc-hist-body">
                  <b>{dateShort(h.cycleStart)} – {dateShort(h.date)}</b>
                  <span>spent {money(h.spent)} · paid {money(h.paidInTime)}{h.dueDate ? ` by ${dateShort(h.dueDate)}` : ''}</span>
                </span>
                <span className="cc-hist-amt num">{money(h.billed)}</span>
                <span className={`badge badge--${tone}`}>{label}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="cc-section">
        <div className="cc-head"><h3 className="cc-title">Card details</h3></div>
        <div className="strip"><span className="k">Credit limit</span><span className="v num">{card.limit > 0 ? money(card.limit) : 'Not set'}</span></div>
        <div className="strip"><span className="k">Statement date</span><span className="v">{ordinal(card.statementDay)} of each month</span></div>
        <div className="strip"><span className="k">Payment due</span><span className="v">{card.dueDay ? `${ordinal(card.dueDay)} of the month after` : 'Not set'}</span></div>
        <div className="strip"><span className="k">Renewal</span><span className={`v${card.expired ? ' tone-text-out' : ''}`}>{renewalLine(card.renewal)}</span></div>
        {card.minPct !== null && <div className="strip"><span className="k">Minimum due</span><span className="v">{card.minPct}% of the bill</span></div>}
        {card.apr !== null && <div className="strip"><span className="k">Interest</span><span className="v">{card.apr}% a year</span></div>}
        {card.utilization !== null && <div className="strip"><span className="k">Limit in use</span><span className="v">{pct(card.utilization)}</span></div>}
        {card.notes && <p className="hint">{card.notes}</p>}
        {card.freeDays !== null && card.freeDays >= 0 && (
          <div className="cc-tip">
            <span className="card-ico tone-save"><IconCard /></span>
            <span>
              <b>Buy today and you have {card.freeDays} days before you pay.</b>
              <span>Buying on {dateShort(card.bestDay)}, the day after the statement closes, gives the longest — {card.maxFreeDays} days.</span>
            </span>
          </div>
        )}
      </div>

      <div className="cc-links">
        <button className="card--link cc-link" onClick={goLedger}>
          <span className="cardlink-body"><b>Every entry on {card.name}</b><span>Purchases, refunds and payments, in the ledger.</span></span>
          <IconChevronRight />
        </button>
      </div>
    </Sheet>
  );
}
