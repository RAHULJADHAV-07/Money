import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi, useStore } from '../lib/store.jsx';
import {
  moneyRound, money, moneyParts, compact, todayKey, monthLabel, monthShort, monthProgress,
} from '../lib/format.js';
import TxList from '../components/TxList.jsx';
import { CategoryBars, TrendChart, FlowBar, Ring } from '../components/Charts.jsx';
import { walletHue } from '../lib/palette.js';
import {
  IconArrowUpRight, IconChevronRight, IconChevronDown, IconSpark, IconWallet,
  IconSavings, IconIncoming, IconOutgoing, IconDebt, IconSwap, KindIcon,
} from '../components/Icons.jsx';

const QUICK_ACTIONS = [
  { kind: 'expense', label: 'Spent',    tone: 'out',  icon: <KindIcon kind="expense" /> },
  { kind: 'income',  label: 'Received', tone: 'in',   icon: <KindIcon kind="income" /> },
  { kind: 'lent',    label: 'Lent',     tone: 'flat', icon: <IconDebt /> },
  { kind: 'transfer', label: 'Move',    tone: 'flat', icon: <IconSwap /> },
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
      <div className="tiles" style={{ marginTop: 14 }}>
        {[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 92 }} />)}
      </div>
      <div className="skel" style={{ height: 210, marginTop: 14 }} />
    </div>
  );
}

export default function Home() {
  const { month, currency, openAdd, settings, openMonthSheet } = useStore();
  const navigate = useNavigate();
  const catOrder = settings?.categories || [];
  const walletOrder = settings?.methods || [];
  const { data, loading, error } = useApi(() => api.summary(month, todayKey()), [month]);

  if (error) {
    return (
      <div className="page">
        <div className="error-msg" style={{ marginTop: 16 }} role="alert">{error}</div>
      </div>
    );
  }

  if (loading && !data) return <Skeleton />;

  const { cards, today, monthly, byCategory, trend, recent, wallets = [] } = data;
  const activeWallets = wallets.filter((w) => w.balance !== 0 || w.in !== 0 || w.out !== 0);
  const noData = !recent.length;

  const { elapsed, total, current } = monthProgress(month);
  const pace = elapsed > 0 ? monthly.expense / elapsed : 0;
  const projected = pace * total;
  const topCat = byCategory[0];

  return (
    <>
      <section className="hero">
        <div className="hero-top">
          <span className="hero-label">Balance in hand</span>
          <button className="hero-chip" onClick={openMonthSheet}>
            {monthShort(month)} <IconChevronDown />
          </button>
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
              <span className={`qa-ico tone-${a.tone}`}>{a.icon}</span>
              <span className="qa-label">{a.label}</span>
            </button>
          ))}
        </div>

        <div className="home-grid">
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

          <div className="card g-month">
            <div className="card-head">
              <h2 className="card-title">{monthLabel(month)}</h2>
              <button className="card-action" onClick={openMonthSheet}>Change<IconChevronRight /></button>
            </div>

            <div className="month-summary">
              <FlowBar inAmount={monthly.received} outAmount={monthly.expense} />
              {monthly.income > 0 && (
                <Ring
                  value={Math.max(0, Math.min(1, monthly.savingsRate))}
                  label={`${Math.round(monthly.savingsRate * 100)}%`}
                  sub="kept"
                  color={monthly.savingsRate >= 0 ? 'var(--in)' : 'var(--out)'}
                />
              )}
            </div>

            <div className="strip strip--total">
              <span className="k">Left over</span>
              <span className={`v num ${monthly.net >= 0 ? 'tone-text-in' : 'tone-text-out'}`}>
                {money(monthly.net, currency)}
              </span>
            </div>

            {current && monthly.expense > 0 && (
              <div className="insight">
                <span className="insight-ico"><IconSpark /></span>
                <span>
                  About <strong className="num">{money(Math.round(pace), currency)}</strong> a day so far.
                  Keep this up and {monthShort(month)} lands near <strong className="num">{money(Math.round(projected), currency)}</strong>.
                </span>
              </div>
            )}
            {!current && topCat && (
              <div className="insight">
                <span className="insight-ico"><IconSpark /></span>
                <span>
                  <strong>{topCat.name}</strong> took the largest share — {Math.round(topCat.share * 100)}% of everything spent.
                </span>
              </div>
            )}
          </div>

          {activeWallets.length > 0 && (
            <section className="g-wallets">
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

          {byCategory.length > 0 && (
            <div className="card g-cats">
              <div className="card-head">
                <h2 className="card-title">Where it went</h2>
                <Link className="card-action" to="/ledger">See all<IconChevronRight /></Link>
              </div>
              <CategoryBars rows={byCategory.slice(0, 6)} order={catOrder} />
            </div>
          )}

          {trend.some((t) => t.income || t.expense) && (
            <div className="card g-trend">
              <div className="card-head"><h2 className="card-title">In and out</h2></div>
              <TrendChart data={trend} />
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
    </>
  );
}
