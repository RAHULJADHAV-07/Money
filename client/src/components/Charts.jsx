import { useState } from 'react';
import { money, compact, monthShort } from '../lib/format.js';
import { useStore } from '../lib/store.jsx';
import { hueFor, initialsOf } from '../lib/palette.js';

/* A bar with only its top corners rounded, so every bar sits flat on the
   baseline however short it is. */
function topRounded(x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  return `M${x},${y + h} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${y + h} Z`;
}

/* ── Flow bar ──────────────────────────────────────────────────────────────
   One line that answers "did more come in than went out?" before any number is
   read. Widths are shares of the larger side, so the two are directly comparable. */
export function FlowBar({ inAmount, outAmount }) {
  const { currency } = useStore();
  const max = Math.max(inAmount, outAmount, 1);
  const w = (v) => `${Math.max(v > 0 ? 4 : 0, (v / max) * 100)}%`;

  return (
    <div className="flow">
      <div className="flow-line">
        <span className="flow-k">In</span>
        <span className="flow-track"><i className="flow-fill tone-bg-in" style={{ width: w(inAmount) }} /></span>
        <span className="flow-v num tone-text-in">{money(inAmount, currency)}</span>
      </div>
      <div className="flow-line">
        <span className="flow-k">Out</span>
        <span className="flow-track"><i className="flow-fill tone-bg-out" style={{ width: w(outAmount) }} /></span>
        <span className="flow-v num tone-text-out">{money(outAmount, currency)}</span>
      </div>
    </div>
  );
}

/* ── Progress ring ─────────────────────────────────────────────────────────
   Used where the figure is a share of a whole (savings rate, goal progress) —
   a ring reads as "part of something" in a way a bar does not. */
export function Ring({ value = 0, size = 62, stroke = 7, color = 'var(--in)', label, sub }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${c * v} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-arc"
        />
      </svg>
      <div className="ring-text">
        <span className="ring-v num">{label}</span>
        {sub && <span className="ring-s">{sub}</span>}
      </div>
    </div>
  );
}

/* ── Spend by category ─────────────────────────────────────────────────────
   Each category owns a hue from the fixed categorical order, so it keeps the
   same colour everywhere and across re-sorts; bar length carries the magnitude. */
export function CategoryBars({ rows, max, order = [], onPick }) {
  const { currency } = useStore();
  if (!rows?.length) return null;
  const ceiling = max || Math.max(...rows.map((r) => r.total), 1);

  return (
    <div className="cats">
      {rows.map((r) => {
        const hue = hueFor(r.name, order);
        const Tag = onPick ? 'button' : 'div';

        return (
          <Tag
            className="cat"
            key={r.name}
            {...(onPick ? { type: 'button', onClick: () => onPick(r) } : {})}
          >
            <span className="cat-chip" style={{ background: hue }}>{initialsOf(r.name)}</span>
            <span className="cat-body">
              <span className="cat-top">
                <span className="cat-name">{r.name}</span>
                <span className="cat-amt num">{money(r.total, currency)}</span>
              </span>
              <span className="cat-track">
                <span
                  className="cat-fill"
                  style={{ width: `${Math.max(3, (r.total / ceiling) * 100)}%`, background: hue }}
                />
              </span>
              <span className="cat-sub">
                <span>{Math.round(r.share * 100)}% of spend</span>
              </span>
            </span>
          </Tag>
        );
      })}
    </div>
  );
}

/* ── Money in vs out across recent months ──────────────────────────────────
   Two series on ONE shared money scale, grouped bars, legend always present,
   and the selected month read out in full underneath rather than in a tooltip
   that a thumb would cover. */
export function TrendChart({ data }) {
  const { currency } = useStore();
  const [active, setActive] = useState(null);
  if (!data?.length) return null;

  const max = Math.max(...data.flatMap((d) => [d.income, d.expense]), 1);
  const W = 320, H = 138, padB = 22, padT = 18;
  const plot = H - padB - padT;
  const slot = W / data.length;
  const barW = Math.min(12, slot / 3.6);
  const gap = 3;

  const idx = active != null ? active : data.length - 1;
  const shown = data[idx];

  return (
    <div>
      <div className="legend">
        <span><i className="dot tone-bg-in" /> Money in</span>
        <span><i className="dot tone-bg-out" /> Money out</span>
        <span className="legend-max num">peak {compact(max)}</span>
      </div>

      <svg className="trend" viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img"
           aria-label={`Money in and out, last ${data.length} months`}>
        <line x1="0" y1={padT} x2={W} y2={padT} stroke="var(--grid)" strokeWidth="1" strokeDasharray="2 4" />
        <line x1="0" y1={padT + plot / 2} x2={W} y2={padT + plot / 2} stroke="var(--grid)" strokeWidth="1" strokeDasharray="2 4" />
        <line x1="0" y1={H - padB} x2={W} y2={H - padB} stroke="var(--grid-strong)" strokeWidth="1" />

        {data.map((d, i) => {
          const cx = i * slot + slot / 2;
          const hIn = (d.income / max) * plot;
          const hOut = (d.expense / max) * plot;
          const on = idx === i;
          return (
            <g key={d.month}
               onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}
               onClick={() => setActive(i)} style={{ cursor: 'pointer' }}>
              {on && <rect x={i * slot + 2} y={padT - 12} width={slot - 4} height={H - padB - padT + 12} fill="var(--surface-3)" rx="9" />}
              <rect x={i * slot} y="0" width={slot} height={H} fill="transparent" />
              <path d={topRounded(cx - barW - gap / 2, H - padB - Math.max(hIn, d.income > 0 ? 3 : 0), barW, Math.max(hIn, d.income > 0 ? 3 : 0), 4)}
                    fill="var(--in)" opacity={on ? 1 : .88} />
              <path d={topRounded(cx + gap / 2, H - padB - Math.max(hOut, d.expense > 0 ? 3 : 0), barW, Math.max(hOut, d.expense > 0 ? 3 : 0), 4)}
                    fill="var(--out)" opacity={on ? 1 : .88} />
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="10.5"
                    fill={on ? 'var(--ink)' : 'var(--ink-3)'} fontWeight={on ? 650 : 500}>
                {monthShort(d.month)}
              </text>
            </g>
          );
        })}
      </svg>

      {shown && (
        <div className="trend-read">
          <span className="trend-read-m">{monthShort(shown.month)}</span>
          <span className="trend-read-v">
            <span className="num tone-text-in">+{money(shown.income, currency)}</span>
            <span className="num tone-text-out">−{money(shown.expense, currency)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
