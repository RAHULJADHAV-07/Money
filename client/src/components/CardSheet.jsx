import { useNavigate } from 'react-router-dom';
import Sheet from './Sheet.jsx';
import { useStore } from '../lib/store.jsx';
import { money as fmt, moneyRound, dayLabel, pct } from '../lib/format.js';
import { walletHue } from '../lib/palette.js';
import { billLine, HISTORY_LABEL, utilTone, ordinal } from '../lib/credit.js';
import { IconCard, IconChevronRight, IconInfo } from './Icons.jsx';

/* The bill's month, as a bank heads it: "Oct 2026 statement". */
const billMonth = (key) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

/* How much of the limit is used, drawn as a bar. With no limit set there is
   nothing to fill, so the bar is not drawn at all rather than drawn empty. */
function UsageBar({ card, onDark = false }) {
  if (card.utilization === null) return null;
  const u = Math.min(1, card.utilization);
  return (
    <span className={`cc-bar${onDark ? ' cc-bar--dark' : ''}`} aria-hidden="true">
      <span className={`cc-bar-fill tone-bg-${utilTone(card.utilization)}`} style={{ width: `${Math.max(u * 100, u > 0 ? 3 : 0)}%` }} />
    </span>
  );
}

/*
 * The card as it sits on the home screen: what you owe on it, how much of the
 * limit that is, and the one thing about its bill worth knowing today.
 */
export function CardFace({ card, currency, order, onOpen }) {
  const money = (n) => fmt(n, currency);
  const line = billLine(card.statement, money);
  return (
    <button className="ccard" style={{ '--wc': walletHue(card.name, order) }} onClick={onOpen}>
      <span className="ccard-top">
        <span className="wname">{card.name}</span>
        <span className="ccard-chip"><IconCard />Credit</span>
      </span>
      <span className="ccard-k">{card.credit > 0 ? 'In credit' : 'Owed'}</span>
      <span className="wbal num">{money(card.credit > 0 ? card.credit : card.owed)}</span>
      {card.limit > 0 && (
        <>
          <UsageBar card={card} onDark />
          <span className="wflow num">
            {moneyRound(card.available, currency)} left of {moneyRound(card.limit, currency)}
          </span>
        </>
      )}
      {line.text && <span className={`ccard-bill ccard-bill--${line.tone}`}>{line.text}</span>}
    </button>
  );
}

/*
 * One card's bill, the way the bank would print it — and a way to pay it.
 *
 * Paying opens an ordinary transfer from a wallet of yours into the card. It
 * is a transfer and not an expense on purpose: the spending was counted the
 * day you swiped, and counting the bill again would put every purchase in
 * twice.
 */
export default function CardSheet({ card, wallets = [], onClose }) {
  const { currency, openAdd, settings } = useStore();
  const navigate = useNavigate();
  const money = (n) => fmt(n, currency);
  const st = card.statement;
  const line = billLine(st, money);

  // The wallet a bill is most likely paid from: whichever of yours holds the most.
  const payer = wallets.filter((w) => !w.credit).sort((a, b) => b.balance - a.balance)[0]?.name;

  const pay = (amount, note) => {
    onClose();
    openAdd({ kind: 'transfer', method: payer, toMethod: card.name, amount: amount > 0 ? amount : '', note });
  };
  const goLedger = () => { onClose(); navigate(`/ledger?wallet=${encodeURIComponent(card.name)}`); };
  const goSettings = () => { onClose(); navigate('/settings'); };

  const carrying = st.remaining > 0.005;
  const hasMin = st.remainingMin > 0.005 && st.remainingMin < st.remaining - 0.005;

  return (
    <Sheet title={card.name} subtitle="Credit card" onClose={onClose}>
      <div className="ccard ccard--big" style={{ '--wc': walletHue(card.name, settings?.methods || []) }}>
        <span className="ccard-top">
          <span className="wname">{card.name}</span>
          <span className="ccard-chip"><IconCard />Credit</span>
        </span>
        <span className="ccard-k">{card.credit > 0 ? 'In credit — the bank owes you' : 'Total owed'}</span>
        <span className="wbal num">{money(card.credit > 0 ? card.credit : card.owed)}</span>
        {card.limit > 0 ? (
          <>
            <UsageBar card={card} onDark />
            <span className="ccard-foot num">
              <span>{money(card.available)} available</span>
              <span>{pct(card.utilization)} of {moneyRound(card.limit, currency)}</span>
            </span>
          </>
        ) : (
          <span className="wflow">No limit set — add it in Settings to see what is left.</span>
        )}
      </div>

      {/* ── The bill ─────────────────────────────────────────────────────── */}
      <div className="cc-section">
        <div className="cc-head">
          <h3 className="cc-title">{billMonth(st.date)} statement</h3>
          {line.badge && <span className={`badge badge--${line.tone}`}>{line.badge}</span>}
        </div>
        <p className={`cc-line tone-text-${line.tone === 'warn' ? 'warn' : line.tone === 'flat' ? 'flat' : line.tone}`}>{line.text}</p>

        <div className="kv-grid">
          <div className="kv"><span className="kv-k">Bill amount</span><span className="kv-v num">{money(st.billed)}</span></div>
          <div className="kv"><span className="kv-k">Minimum due</span><span className="kv-v num">{money(st.minDue)}</span></div>
          <div className="kv"><span className="kv-k">Statement date</span><span className="kv-v">{dayLabel(st.date)}</span></div>
          <div className="kv">
            <span className="kv-k">Due date</span>
            <span className={`kv-v${st.status === 'overdue' ? ' tone-text-out' : ''}`}>{dayLabel(st.dueDate)}</span>
          </div>
          <div className="kv"><span className="kv-k">Paid since</span><span className="kv-v num tone-text-in">{money(st.paid)}</span></div>
          <div className="kv"><span className="kv-k">Left to pay</span><span className="kv-v num">{money(st.remaining)}</span></div>
        </div>

        {carrying ? (
          <div className="cc-pay">
            <button className="btn btn--primary btn--block" onClick={() => pay(st.remaining, `${card.name} bill`)}>
              Pay full bill · {money(st.remaining)}
            </button>
            <div className="btn-row">
              {hasMin && (
                <button className="btn btn--block" onClick={() => pay(st.remainingMin, `${card.name} minimum due`)}>
                  Minimum · {money(st.remainingMin)}
                </button>
              )}
              <button className="btn btn--block" onClick={() => pay(0, `${card.name} payment`)}>Other amount</button>
            </div>
          </div>
        ) : card.owed > 0.005 ? (
          <div className="cc-pay">
            <button className="btn btn--block" onClick={() => pay(card.owed, `${card.name} payment`)}>
              Pay off everything now · {money(card.owed)}
            </button>
          </div>
        ) : null}

        {carrying && card.apr > 0 && (
          <div className="note-box note-box--warn">
            <IconInfo />
            <span>
              {st.status === 'carried' || st.status === 'overdue'
                ? `Interest is being charged on the ${money(st.remaining)} left — about ${money(card.interestIfCarried)} a month at ${card.apr}% a year — and new purchases get no interest-free days until it is cleared.`
                : `Pay the full ${money(st.remaining)} by ${dayLabel(st.dueDate)} and there is no interest at all. Pay only part and about ${money(card.interestIfCarried)} a month is added at ${card.apr}% a year, and new purchases stop being interest-free.`}
              {st.status === 'overdue' && ' A late fee is usually added too, and the missed payment reaches your credit score.'}
            </span>
          </div>
        )}
      </div>

      {/* ── The cycle running now ────────────────────────────────────────── */}
      <div className="cc-section">
        <div className="cc-head">
          <h3 className="cc-title">This cycle</h3>
          <span className="cc-sub">{dayLabel(card.cycle.start)} – {dayLabel(card.cycle.end)}</span>
        </div>
        <div className="strip"><span className="k">Spent so far, not yet billed</span><span className="v num">{money(card.cycle.unbilled)}</span></div>
        <div className="strip">
          <span className="k">Next statement</span>
          <span className="v">{dayLabel(card.cycle.end)} · {card.cycle.daysToStatement === 0 ? 'today' : `in ${card.cycle.daysToStatement} days`}</span>
        </div>
        <div className="strip"><span className="k">Its bill is due</span><span className="v">{dayLabel(card.nextDue)}</span></div>
        <div className="cc-tip">
          <span className="card-ico tone-save"><IconCard /></span>
          <span>
            <b>Buy today and you have {card.freeDays} days before you pay.</b>
            <span>
              The longest stretch is buying on the {ordinal(Number(card.bestDay.slice(8)))}, the day after the statement —
              {` ${card.maxFreeDays} days`} interest-free. Next one: {dayLabel(card.bestDay)}.
            </span>
          </span>
        </div>
      </div>

      {/* ── Earlier statements ───────────────────────────────────────────── */}
      {card.history.length > 0 && (
        <div className="cc-section">
          <div className="cc-head"><h3 className="cc-title">Earlier statements</h3></div>
          {card.history.map((h) => {
            const [label, tone] = HISTORY_LABEL[h.status] || ['', 'flat'];
            return (
              <div key={h.date} className="cc-hist">
                <span className="cc-hist-body">
                  <b>{billMonth(h.date)}</b>
                  <span>spent {money(h.spent)} · paid {money(h.paidByDue)} by {dayLabel(h.dueDate)}</span>
                </span>
                <span className="cc-hist-amt num">{money(h.billed)}</span>
                <span className={`badge badge--${tone}`}>{label}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="cc-links">
        <button className="card--link cc-link" onClick={goLedger}>
          <span className="cardlink-body"><b>Every entry on {card.name}</b><span>Swipes, refunds and payments, in the ledger.</span></span>
          <IconChevronRight />
        </button>
        <button className="card--link cc-link" onClick={goSettings}>
          <span className="cardlink-body">
            <b>Card terms</b>
            <span>
              {card.limit > 0 ? `${moneyRound(card.limit, currency)} limit · ` : ''}
              bill on the {ordinal(card.statementDay)}, due the {ordinal(card.dueDay)} · {card.apr}% a year
            </span>
          </span>
          <IconChevronRight />
        </button>
      </div>
    </Sheet>
  );
}
