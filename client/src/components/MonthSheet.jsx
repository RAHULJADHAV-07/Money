import { useEffect, useMemo, useState } from 'react';
import Sheet from './Sheet.jsx';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import {
  money, compact, monthLabel, monthShort, shiftMonth, monthKeyNow,
  todayKey, shiftDay, fullDayLabel, dayLabel,
} from '../lib/format.js';
import { IconChevronLeft, IconChevronRight } from './Icons.jsx';
import TxList from './TxList.jsx';

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const VIEWS = [['day', 'Day'], ['month', 'Month'], ['year', 'Year']];

/* Spend on a 0–5 sequential scale. One hue, light→dark: magnitude only. */
function heatOf(spent, max) {
  if (!spent || max <= 0) return 0;
  const r = spent / max;
  return r > 0.75 ? 5 : r > 0.5 ? 4 : r > 0.28 ? 3 : r > 0.12 ? 2 : 1;
}

// Monday-first. Day 1 is placed in its own weekday column — no blank cells.
function gridFor(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [];
  for (let d = 1; d <= total; d++) cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  return { cells, lead };
}

export default function MonthSheet() {
  const { month, setMonth, day, setDay, closeMonthSheet, currency, openAdd } = useStore();
  const today = todayKey();
  const thisMonth = monthKeyNow();

  const [view, setView] = useState(day ? 'day' : 'month');
  const [cursorDay, setCursorDay] = useState(day || today);
  const [cursorMonth, setCursorMonth] = useState(month);
  const [cursorYear, setCursorYear] = useState(Number(month.slice(0, 4)));

  const [cal, setCal] = useState(null);
  const [yearData, setYearData] = useState(null);
  const [dayTx, setDayTx] = useState(null);
  const [loading, setLoading] = useState(true);

  // The month grid backs both the month view and the day view's context.
  const activeMonth = view === 'day' ? cursorDay.slice(0, 7) : cursorMonth;

  useEffect(() => {
    if (view === 'year') return;
    let alive = true;
    setLoading(true);
    api.calendar(activeMonth)
      .then((d) => alive && setCal(d))
      .catch(() => alive && setCal(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [activeMonth, view]);

  useEffect(() => {
    if (view !== 'year') return;
    let alive = true;
    setLoading(true);
    api.yearSummary(cursorYear)
      .then((d) => alive && setYearData(d))
      .catch(() => alive && setYearData(null))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [cursorYear, view]);

  useEffect(() => {
    if (view !== 'day') return;
    let alive = true;
    api.transactions({ from: cursorDay, to: cursorDay, limit: 100 })
      .then((d) => alive && setDayTx(d.items))
      .catch(() => alive && setDayTx([]));
    return () => { alive = false; };
  }, [cursorDay, view]);

  const byDay = useMemo(() => {
    const map = {};
    for (const d of cal?.days || []) map[d.day] = d;
    return map;
  }, [cal]);

  // ‹ › always steps by whatever unit is on screen.
  const step = (dir) => {
    if (view === 'day') setCursorDay(shiftDay(cursorDay, dir));
    else if (view === 'month') setCursorMonth(shiftMonth(cursorMonth, dir));
    else setCursorYear(cursorYear + dir);
  };

  const nextDisabled =
    view === 'day' ? cursorDay >= today
    : view === 'month' ? cursorMonth >= thisMonth
    : cursorYear >= Number(thisMonth.slice(0, 4));

  const title =
    view === 'day' ? (cursorDay === today ? 'Today' : dayLabel(cursorDay))
    : view === 'month' ? monthLabel(cursorMonth)
    : String(cursorYear);

  const apply = () => {
    if (view === 'day') { setMonth(cursorDay.slice(0, 7)); setDay(cursorDay); }
    else if (view === 'month') { setMonth(cursorMonth); setDay(null); }
    else { setMonth(`${cursorYear}-01`); setDay(null); }
    closeMonthSheet();
  };

  const dayInfo = byDay[cursorDay];

  const footer = (
    <div className="btn-row">
      {day && <button className="btn btn--block" onClick={() => { setDay(null); closeMonthSheet(); }}>Clear day</button>}
      <button className="btn btn--primary btn--block" onClick={apply}>
        {view === 'day' ? `Show ${cursorDay === today ? 'today' : dayLabel(cursorDay)}`
          : view === 'month' ? `Show ${monthShort(cursorMonth)}`
          : `Show ${cursorYear}`}
      </button>
    </div>
  );

  return (
    <Sheet title="Jump to" subtitle="Pick a day, a month or a whole year" onClose={closeMonthSheet} footer={footer}>
      <div className="seg" role="tablist" aria-label="Calendar range">
        {VIEWS.map(([id, label]) => (
          <button key={id} className="seg-btn" role="tab" aria-selected={view === id}
                  onClick={() => setView(id)}>{label}</button>
        ))}
      </div>

      <div className="cal-head">
        <div className="cal-title">{title}</div>
        <div className="cal-nav">
          <button onClick={() => step(-1)} aria-label="Previous"><IconChevronLeft /></button>
          <button onClick={() => step(1)} disabled={nextDisabled} aria-label="Next"><IconChevronRight /></button>
        </div>
      </div>

      {/* ── Day ─────────────────────────────────────────────────────────── */}
      {view === 'day' && (
        <>
          <div className="daycard">
            <div className="daycard-date">{fullDayLabel(cursorDay)}</div>
            <div className="daycard-row">
              <div>
                <span className="k">Spent</span>
                <span className="v num tone-text-out">{money(dayInfo?.spent || 0, currency)}</span>
              </div>
              <div>
                <span className="k">Received</span>
                <span className="v num tone-text-in">{money(dayInfo?.received || 0, currency)}</span>
              </div>
            </div>
          </div>

          {dayTx === null ? (
            <div className="skel" style={{ height: 130, marginTop: 14 }} />
          ) : dayTx.length ? (
            <div className="card card--flush" style={{ marginTop: 14 }}>
              <TxList items={dayTx} showDays={false} onPick={(tx) => { closeMonthSheet(); openAdd({ tx }); }} />
            </div>
          ) : (
            <div className="empty empty--sm">
              <div className="empty-t">Nothing logged</div>
              <div className="empty-s">No entries on this day.</div>
            </div>
          )}
        </>
      )}

      {/* ── Month ───────────────────────────────────────────────────────── */}
      {view === 'month' && (
        <>
          <div className="cal-grid cal-grid--dow">
            {DOW.map((d, i) => <div className="cal-dow" key={i}>{d}</div>)}
          </div>
          <div className="cal-grid">
            {(() => {
              const { cells, lead } = gridFor(cursorMonth);
              const max = cal?.maxSpent || 0;
              return cells.map((key, i) => {
                const d = byDay[key];
                const heat = heatOf(d?.spent, max);
                const cls = ['cal-day', heat ? `h${heat}` : '',
                  key === today ? 'today' : '', key === day ? 'picked' : '',
                  key > today ? 'future' : ''].filter(Boolean).join(' ');
                return (
                  <button className={cls} key={key}
                          style={i === 0 ? { gridColumnStart: lead + 1 } : undefined}
                          onClick={() => { setCursorDay(key); setView('day'); }}
                          aria-label={`${key}${d ? `, spent ${d.spent}` : ', nothing logged'}`}>
                    <span className="n">{Number(key.slice(8))}</span>
                    {d?.spent > 0 && <span className="amt num">{compact(d.spent)}</span>}
                    {d?.received > 0 && <span className="got" />}
                  </button>
                );
              });
            })()}
          </div>

          <div className="cal-legend">
            <span className="cal-scale">
              Less
              {[0, 1, 2, 3, 4, 5].map((i) => <i key={i} style={{ background: `var(--heat-${i})` }} />)}
              More
            </span>
            <span className="cal-scale"><i className="dot tone-bg-in" /> money in</span>
          </div>

          <div className="card">
            {loading && !cal ? <div className="skel" style={{ height: 64 }} /> : (
              <>
                <div className="strip">
                  <span className="k">Spent in {monthShort(cursorMonth)}</span>
                  <span className="v num tone-text-out">{money(cal?.totalSpent || 0, currency)}</span>
                </div>
                <div className="strip">
                  <span className="k">Received</span>
                  <span className="v num tone-text-in">{money(cal?.totalReceived || 0, currency)}</span>
                </div>
                <div className="strip">
                  <span className="k">Days with activity</span>
                  <span className="v num">{cal?.activeDays || 0}</span>
                </div>
                {cal?.busiest && (
                  <div className="strip">
                    <span className="k">Heaviest day</span>
                    <span className="v num">
                      {dayLabel(cal.busiest.day)} · {money(cal.busiest.spent, currency)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ── Year ────────────────────────────────────────────────────────── */}
      {view === 'year' && (
        <>
          {loading && !yearData ? <div className="skel" style={{ height: 270 }} /> : (
            <div className="year-grid">
              {(yearData?.months || []).map((m) => {
                const max = yearData?.maxSpent || 0;
                const pct = max > 0 ? Math.round((m.spent / max) * 100) : 0;
                const ahead = m.month > thisMonth;
                return (
                  <button key={m.month} className={`year-cell ${m.month === month ? 'picked' : ''} ${ahead ? 'future' : ''}`}
                          disabled={ahead}
                          onClick={() => { setCursorMonth(m.month); setView('month'); }}>
                    <span className="ym">{MONTHS[Number(m.month.slice(5)) - 1]}</span>
                    <span className="yv num">{m.spent > 0 ? compact(m.spent) : '—'}</span>
                    <span className="ybar"><i style={{ width: `${Math.max(pct, m.spent > 0 ? 4 : 0)}%` }} /></span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="card">
            <div className="strip">
              <span className="k">Spent in {cursorYear}</span>
              <span className="v num tone-text-out">{money(yearData?.totalSpent || 0, currency)}</span>
            </div>
            <div className="strip">
              <span className="k">Received</span>
              <span className="v num tone-text-in">{money(yearData?.totalReceived || 0, currency)}</span>
            </div>
          </div>
        </>
      )}
    </Sheet>
  );
}
