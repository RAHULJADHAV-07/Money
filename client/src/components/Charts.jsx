import { useState } from 'react';
import { money, compact, monthShort } from '../lib/format.js';
import { useStore } from '../lib/store.jsx';

/* Spend by category: one measure across categories, so a single hue carries
   magnitude and the row label carries identity — no legend needed. */
export function CategoryBars({ rows, max }) {
  const { currency } = useStore();
  if (!rows?.length) return null;
  const ceiling = max || Math.max(...rows.map((r) => r.total), 1);

  return rows.map((r) => {
    const over = r.budget > 0 && r.total > r.budget;
    return (
      <div className="bar-row" key={r.name}>
        <span className="name">{r.name}</span>
        <span className="val tabular">{money(r.total, currency)}</span>
        <span className="bar-track">
          <span
            className="bar-fill"
            style={{ width: `${Math.max(2, (r.total / ceiling) * 100)}%`, background: over ? 'var(--out)' : 'var(--save)' }}
          />
        </span>
        <span className="bar-sub">
          {Math.round(r.share * 100)}% of spend
          {r.budget > 0 && ` · budget ${money(r.budget, currency)}${over ? ' — over' : ''}`}
        </span>
      </div>
    );
  });
}

/* Money in vs out across recent months. Two series on ONE shared money scale,
   grouped bars, legend always present, latest month directly labelled. */
export function TrendChart({ data }) {
  const { currency } = useStore();
  const [active, setActive] = useState(null);
  if (!data?.length) return null;

  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);
  const W = 320, H = 132, padB = 20, padT = 16;
  const plot = H - padB - padT;
  const slot = W / data.length;
  const barW = Math.min(13, slot / 3.4);
  const gap = 2; // surface gap between adjacent fills

  const shown = active != null ? data[active] : data.at(-1);

  return (
    <div>
      <div className="legend" style={{ marginBottom: 8 }}>
        <span><i className="dot in" /> Money in</span>
        <span><i className="dot out" /> Money out</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
           aria-label={`Money in and out, last ${data.length} months`}>
        <line x1="0" y1={H - padB} x2={W} y2={H - padB} stroke="var(--grid)" strokeWidth="1" />
        {data.map((d, i) => {
          const cx = i * slot + slot / 2;
          const hIn = (d.income / max) * plot;
          const hOut = (d.expense / max) * plot;
          const isLast = i === data.length - 1;
          return (
            <g key={d.month} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
               onClick={() => setActive(i)} style={{ cursor: 'pointer' }}>
              <rect x={i * slot} y="0" width={slot} height={H} fill="transparent" />
              {active === i && <rect x={i * slot} y="0" width={slot} height={H - padB} fill="var(--surface-hover)" rx="6" />}
              <rect x={cx - barW - gap / 2} y={H - padB - hIn} width={barW} height={Math.max(hIn, d.income > 0 ? 2 : 0)}
                    rx="4" fill="var(--in)" />
              <rect x={cx + gap / 2} y={H - padB - hOut} width={barW} height={Math.max(hOut, d.expense > 0 ? 2 : 0)}
                    rx="4" fill="var(--out)" />
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="10"
                    fill={isLast || active === i ? 'var(--text-secondary)' : 'var(--text-muted)'}
                    fontWeight={isLast ? 600 : 400}>
                {monthShort(d.month)}
              </text>
              {(isLast || active === i) && d.income > 0 && (
                <text x={cx - barW / 2 - gap / 2} y={H - padB - hIn - 4} textAnchor="middle" fontSize="9"
                      fill="var(--text-secondary)" fontWeight="600">{compact(d.income)}</text>
              )}
              {(isLast || active === i) && d.expense > 0 && (
                <text x={cx + barW / 2 + gap / 2} y={H - padB - hOut - 4} textAnchor="middle" fontSize="9"
                      fill="var(--text-secondary)" fontWeight="600">{compact(d.expense)}</text>
              )}
            </g>
          );
        })}
      </svg>

      {shown && (
        <div className="strip" style={{ borderTop: '1px solid var(--border)', paddingTop: 9, marginTop: 2 }}>
          <span className="k">{monthShort(shown.month)} — in / out</span>
          <span className="v tabular">
            <span style={{ color: 'var(--in)' }}>{money(shown.income, currency)}</span>
            <span className="muted"> / </span>
            <span style={{ color: 'var(--out)' }}>{money(shown.expense, currency)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
