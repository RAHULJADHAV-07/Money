import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi, useStore } from '../lib/store.jsx';
import { moneyRound, money, todayKey, monthLabel, shiftMonth, monthKeyNow } from '../lib/format.js';
import TxList from '../components/TxList.jsx';
import { CategoryBars, TrendChart } from '../components/Charts.jsx';

function MonthNav() {
  const { month, setMonth } = useStore();
  const atNow = month >= monthKeyNow();
  return (
    <div className="month-nav">
      <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">‹</button>
      <span className="label">{monthLabel(month)}</span>
      <button onClick={() => setMonth(shiftMonth(month, 1))} disabled={atNow} aria-label="Next month">›</button>
    </div>
  );
}

export default function Home() {
  const { month, currency, openAdd } = useStore();
  const navigate = useNavigate();
  const { data, loading, error } = useApi(() => api.summary(month, todayKey()), [month]);

  if (error) return <div className="page"><div className="error" style={{ marginTop: 16 }}>{error}</div></div>;

  if (loading && !data) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 150, margin: '16px 0' }} />
        <div className="tiles">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 78 }} />)}
        </div>
      </div>
    );
  }

  const { cards, today, monthly, byCategory, trend, recent } = data;
  const noData = !recent.length;

  return (
    <>
      <div className="hero">
        <div className="label">Balance in hand</div>
        <div className="amount tabular">{moneyRound(cards.balance, currency)}</div>
        <div className="foot">
          <div>
            <div className="k">Spent today</div>
            <div className="v tabular">{money(today.spent, currency)}</div>
          </div>
          <div>
            <div className="k">Received today</div>
            <div className="v tabular">{money(today.received, currency)}</div>
          </div>
        </div>
      </div>

      <div className="page">
        <div className="tiles">
          <button className="tile" onClick={() => navigate('/people')}>
            <div className="k"><i className="dot in" />To receive</div>
            <div className="v in tabular">{moneyRound(cards.toReceive, currency)}</div>
            <div className="note">money lent out</div>
          </button>
          <button className="tile" onClick={() => navigate('/people')}>
            <div className="k"><i className="dot out" />To pay back</div>
            <div className="v out tabular">{moneyRound(cards.toPay, currency)}</div>
            <div className="note">money borrowed</div>
          </button>
          <button className="tile" onClick={() => navigate('/savings')}>
            <div className="k"><i className="dot save" />Savings</div>
            <div className="v save tabular">{moneyRound(cards.savings, currency)}</div>
            <div className="note">set aside</div>
          </button>
          <button className="tile" onClick={() => navigate('/ledger')}>
            <div className="k"><i className="dot" style={{ background: 'var(--text-muted)' }} />Net worth</div>
            <div className="v tabular">{moneyRound(cards.netWorth, currency)}</div>
            <div className="note">after dues</div>
          </button>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>This month</h2>
            <MonthNav />
          </div>
          <div className="strip">
            <span className="k">Money in</span>
            <span className="v tabular" style={{ color: 'var(--in)' }}>{money(monthly.received, currency)}</span>
          </div>
          <div className="strip">
            <span className="k">Money out</span>
            <span className="v tabular" style={{ color: 'var(--out)' }}>{money(monthly.expense, currency)}</span>
          </div>
          <div className="strip" style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 10 }}>
            <span className="k" style={{ fontWeight: 600 }}>Left over</span>
            <span className="v tabular" style={{ color: monthly.net >= 0 ? 'var(--in)' : 'var(--out)' }}>
              {money(monthly.net, currency)}
            </span>
          </div>
          {monthly.income > 0 && (
            <div className="hint">
              You kept {Math.round(monthly.savingsRate * 100)}% of what came in this month.
            </div>
          )}
        </div>

        {byCategory.length > 0 && (
          <div className="card">
            <div className="card-head">
              <h2>Where it went</h2>
              <Link className="more" to="/ledger">See all</Link>
            </div>
            <CategoryBars rows={byCategory.slice(0, 6)} />
          </div>
        )}

        {trend.some((t) => t.income || t.expense) && (
          <div className="card">
            <div className="card-head"><h2>Last 6 months</h2></div>
            <TrendChart data={trend} />
          </div>
        )}

        <div className="card">
          <div className="card-head">
            <h2>Recent</h2>
            <Link className="more" to="/ledger">See all</Link>
          </div>
          {noData ? (
            <div className="empty">
              <div className="big">₹</div>
              <div className="t">No entries yet</div>
              <div className="s">Tap the + button to log your first expense or income.</div>
              <button className="btn btn-in btn-sm" style={{ marginTop: 14 }} onClick={() => openAdd({ kind: 'expense' })}>
                Add first entry
              </button>
            </div>
          ) : (
            <TxList items={recent} showDays={false} onPick={(tx) => openAdd({ tx })} />
          )}
        </div>
      </div>
    </>
  );
}
