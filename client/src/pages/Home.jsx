import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi, useStore } from '../lib/store.jsx';
import { moneyRound, money, moneyParts, compact, todayKey, monthKeyNow, monthShort } from '../lib/format.js';
import TxList from '../components/TxList.jsx';
import Alert from '../components/Alert.jsx';
import { CategoryBars } from '../components/Charts.jsx';
import { walletHue } from '../lib/palette.js';
import { KINDS } from '../lib/kinds.js';
import {
  IconArrowUpRight, IconChevronRight, IconWallet, IconCheck,
  IconSavings, IconIncoming, IconOutgoing, KindIcon,
} from '../components/Icons.jsx';

const DONE_LABEL = {
  daily: 'Done today', weekly: 'Done this week',
  monthly: 'Done this month', yearly: 'Done this year',
};

/* The four entries worth reaching for without thinking. Lending and borrowing
   sit beside spending and receiving because they are just as common here, and
   each carries the direction its money actually goes. */
const QUICK_ACTIONS = [
  { kind: 'expense',  label: 'Spent',    tone: 'out' },
  { kind: 'income',   label: 'Received', tone: 'in'  },
  { kind: 'lent',     label: 'Lent',     tone: 'out' },
  { kind: 'borrowed', label: 'Borrowed', tone: 'in'  },
];

function HeroAmount({ value, currency }) {
  const { sign, whole, paise } = moneyParts(value, currency);
  return (
    <div className="hero-amt num">
      {sign && <span className="hero-sign">{sign}</span>}
      <span className="hero-cur">{currency}</span>
      <span className="hero-whole">{whole}</span>
      {paise && <span className="hero-paise">.{paise}</span>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="page">
      <div className="skel" style={{ height: 186, borderRadius: 26, marginTop: 14 }} />
      <div className="skel" style={{ height: 74, marginTop: 14 }} />
      <div className="skel" style={{ height: 104, marginTop: 14 }} />
      <div className="tiles" style={{ marginTop: 14 }}>
        {[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 92 }} />)}
      </div>
      <div className="skel" style={{ height: 210, marginTop: 14 }} />
    </div>
  );
}

export default function Home() {
  const { currency, openAdd, settings, refresh, notify, apiBehind } = useStore();
  const navigate = useNavigate();
  /* The dashboard is this month, always. Stepping back through months is what
     the ledger is for, and a second stepper here only ever answered a question
     nobody was asking of a screen titled "at a glance". */
  const month = monthKeyNow();
  const catOrder = settings?.categories || [];
  const walletOrder = settings?.methods || [];
  const { data, loading, error } = useApi(() => api.summary(month, todayKey()), [month]);
  /* A routine outside its own date range is not offered at all -- `active` is
     false only once the API knows about ranges, so an older one shows them all. */
  const routines = (useApi(() => api.routines(todayKey()), []).data?.items || [])
    .filter((r) => r.active !== false);
  const [ask, setAsk] = useState(null);      // the routine awaiting a yes
  const [alert, setAlert] = useState(null);
  const [running, setRunning] = useState(false);

  /* Nothing is written until you say yes, and the confirmation names the amount
     and where it lands -- a one-tap button is only safe if it cannot be tapped
     by accident. A routine already done stays tappable, and says so instead. */
  async function run(routine) {
    setRunning(true);
    try {
      await api.runRoutine(routine._id);
      setAsk(null);
      notify(`${routine.label} added`);
      refresh();
    } catch (err) {
      setAsk(null);
      setAlert({
        title: err.code === 'INSUFFICIENT_FUNDS' ? 'Not enough in that wallet' : 'Could not add it',
        message: err.message,
      });
    } finally { setRunning(false); }
  }

  if (error) {
    return (
      <div className="page">
        <div className="error-msg" style={{ marginTop: 16 }} role="alert">{error}</div>
      </div>
    );
  }

  if (loading && !data) return <Skeleton />;

  const { cards, today, byCategory, recent, wallets = [] } = data;
  const activeWallets = wallets.filter((w) => w.balance !== 0 || w.in !== 0 || w.out !== 0);
  const noData = !recent.length;

  return (
    <>
      <section className="hero" data-tour="balance">
        <div className="hero-top">
          <span className="hero-label">Balance in hand</span>
        </div>

        <HeroAmount value={cards.balance} currency={currency} />

        <div className="hero-foot">
          <div className="hero-stat">
            <span className="k">Spent today</span>
            <span className="v num">{money(today.spent, currency)}</span>
          </div>
          <div className="hero-stat">
            <span className="k">Received today</span>
            <span className="v num">{money(today.received, currency)}</span>
          </div>
        </div>
      </section>

      <div className="page">
        <div className="qa">
          {QUICK_ACTIONS.map((a) => (
            <button key={a.kind} className="qa-item" onClick={() => openAdd({ kind: a.kind })}>
              <span className={`qa-ico tone-${a.tone}`}><KindIcon kind={a.kind} /></span>
              <span className="qa-label">{a.label}</span>
            </button>
          ))}
        </div>

        <div className="home-grid">
          {activeWallets.length > 0 && (
            <section className="g-wallets" data-tour="wallets">
              <div className="section-label">Where your money sits</div>
              <div className="wallet-rail">
                {activeWallets.map((w) => {
                  const hue = walletHue(w.name, walletOrder);
                  return (
                    <button
                      key={w.name}
                      className={`wcard ${w.balance < 0 ? 'neg' : ''}`}
                      style={{ '--wc': hue }}
                      onClick={() => navigate('/ledger')}
                    >
                      <span className="wcard-top">
                        <span className="wname">{w.name}</span>
                        <IconArrowUpRight />
                      </span>
                      <span className="wbal num">{money(w.balance, currency)}</span>
                      <span className="wflow">
                        {monthShort(month)} · +{compact(w.monthIn)} / −{compact(w.monthOut)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {routines.length > 0 && !apiBehind && (
            <section className="routines g-routines">
              <div className="section-label">One tap</div>
              {routines.map((r) => (
                <button
                  key={r._id}
                  className={`rt-chip${r.due ? '' : ' rt-chip--done'}`}
                  onClick={() => setAsk(r)}
                >
                  <span className={`rt-chip-ico tone-${KINDS[r.kind]?.tone || 'out'}`}>
                    {r.due ? <KindIcon kind={r.kind} /> : <IconCheck />}
                  </span>
                  <span className="rt-chip-body">
                    <span className="rt-chip-n">{r.label}</span>
                    <span className="rt-chip-s">{r.due ? KINDS[r.kind]?.short : (DONE_LABEL[r.cadence] || 'Done')}</span>
                  </span>
                  <span className="rt-chip-a num">{money(r.amount, currency)}</span>
                </button>
              ))}
            </section>
          )}

          <div className="tiles g-tiles">
            <button className="tile" onClick={() => navigate('/people')}>
              <span className="tile-ico tone-in"><IconIncoming /></span>
              <span className="tile-k">To receive</span>
              <span className="tile-v num tone-text-in">{moneyRound(cards.toReceive, currency)}</span>
              <span className="tile-note">money you lent out</span>
            </button>
            <button className="tile" onClick={() => navigate('/people')}>
              <span className="tile-ico tone-out"><IconOutgoing /></span>
              <span className="tile-k">To pay back</span>
              <span className="tile-v num tone-text-out">{moneyRound(cards.toPay, currency)}</span>
              <span className="tile-note">money you borrowed</span>
            </button>
            <button className="tile" onClick={() => navigate('/savings')}>
              <span className="tile-ico tone-save"><IconSavings /></span>
              <span className="tile-k">Savings</span>
              <span className="tile-v num tone-text-save">{moneyRound(cards.savings, currency)}</span>
              <span className="tile-note">set aside so far</span>
            </button>
            <button className="tile" onClick={() => navigate('/ledger')}>
              <span className="tile-ico tone-flat"><IconWallet /></span>
              <span className="tile-k">Net worth</span>
              <span className="tile-v num">{moneyRound(cards.netWorth, currency)}</span>
              <span className="tile-note">wallets, savings, dues</span>
            </button>
          </div>

          {byCategory.length > 0 && (
            <div className="card g-cats">
              <div className="card-head">
                <h2 className="card-title">Where it went</h2>
                <Link className="card-action" to="/ledger">See all<IconChevronRight /></Link>
              </div>
              <CategoryBars rows={byCategory.slice(0, 6)} order={catOrder} />
            </div>
          )}

          <div className="card card--flush g-recent">
            <div className="card-head card-head--inset">
              <h2 className="card-title">Recent</h2>
              <Link className="card-action" to="/ledger">See all<IconChevronRight /></Link>
            </div>
            {noData ? (
              <div className="empty">
                <div className="empty-ico"><IconWallet /></div>
                <div className="empty-t">No entries yet</div>
                <div className="empty-s">Log your first expense or income and this screen fills itself in.</div>
                <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={() => openAdd({ kind: 'expense' })}>
                  Add first entry
                </button>
              </div>
            ) : (
              <TxList items={recent} showDays={false} onPick={(tx) => openAdd({ tx })} />
            )}
          </div>
        </div>
      </div>

      {ask && (
        <Alert
          tone="in"
          title={ask.due ? `Add ${ask.label}?` : `${ask.label} is already done`}
          message={
            `${money(ask.amount, currency)} — ${describeRoutine(ask)}, from ${ask.method}, dated today.` +
            (ask.due ? '' : ` You last did this on ${String(ask.lastDone).slice(0, 10)}. Add it again?`)
          }
          action={running ? 'Adding…' : 'Yes, add it'}
          cancel="Not now"
          onConfirm={() => !running && run(ask)}
          onClose={() => !running && setAsk(null)}
        />
      )}

      {alert && <Alert title={alert.title} message={alert.message} onClose={() => setAlert(null)} />}
    </>
  );
}

// What the entry will say, in the confirmation, before it exists.
function describeRoutine(r) {
  if (r.goal) return `into ${r.goal.name || 'general savings'}`;
  if (r.category) return `spent on ${r.category}`;
  if (r.source) return `received from ${r.source}`;
  if (r.person) return `with ${r.person}`;
  return KINDS[r.kind]?.label?.toLowerCase() || 'entry';
}
