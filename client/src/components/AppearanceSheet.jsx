import { useEffect, useRef, useState } from 'react';
import Sheet from './Sheet.jsx';
import { useTheme, THEMES } from '../lib/theme.js';
import {
  ACCENTS, SURFACES, useAppearance, setAppearance, paintAppearance, resetAppearance, previewFor,
} from '../lib/appearance.js';
import { IconSun, IconMoon, IconAuto, IconCheck } from './Icons.jsx';

const THEME_ICON = { system: <IconAuto />, light: <IconSun />, dark: <IconMoon /> };

/* ── Appearance ─────────────────────────────────────────────────────────────
   Colour mode, how much of the accent the surfaces carry, and the accent
   itself. Every swatch and tile paints live, because a description of a colour
   is no use — the only way to choose one is to see it on the app. */

/* One tile's worth of app: canvas, a hero bar, and a card with an accent line. */
function Mini({ canvas, surface, line, accent }) {
  return (
    <span className="ap-mini" style={{ background: canvas, borderColor: line }} aria-hidden="true">
      <span className="ap-mini-bar" style={{ background: `linear-gradient(90deg, ${accent}, ${canvas})` }} />
      <span className="ap-mini-card" style={{ background: surface, borderColor: line }}>
        <i style={{ background: line }} />
        <i className="short" style={{ background: accent }} />
      </span>
    </span>
  );
}

function Panel() {
  const [theme, setTheme, resolved] = useTheme();
  const { accent, surface } = useAppearance();

  /* The slider needs a value of its own while it is being dragged.
     Painting alone is not enough: this is a controlled input, so if the only
     thing a drag changes is a css variable, React re-renders it straight back
     to the stored hue and the thumb cannot move at all — and the commit on
     release then reads that reset value and saves the hue you started from.
     Which is exactly how it behaved.

     So the drag is held here and the stored value is written on release, which
     also keeps a scrub across the spectrum from hitting storage every frame.
     The ref shadows the state because the release handler has to read the
     latest hue, not the one captured when its render closed over it. */
  const [dragHue, setDragHue] = useState(null);
  const dragRef = useRef(null);
  const shown = dragHue ?? accent;
  const named = ACCENTS.find((a) => a.h === shown);

  const scrub = (h) => {
    const n = Number(h);
    dragRef.current = n;
    setDragHue(n);
    paintAppearance({ accent: n });
  };
  const settle = () => {
    if (dragRef.current === null) return;
    setAppearance({ accent: dragRef.current });
    dragRef.current = null;
    setDragHue(null);
  };
  /* Closing the sheet mid-drag would otherwise leave the app painted in a hue
     that was never saved, and snap back on the next load. */
  useEffect(() => settle, []);   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Three rows, and all of them on screen at once. The first version put
          each choice in its own labelled block with a paragraph of explanation
          under every tile, which pushed the hue slider below the fold — so the
          one control that needs to be dragged was the one you had to go looking
          for. Names carry the explanation now, and the prose is gone. */}
      <div className="ap-row">
        <span className="ap-k">Mode</span>
        <div className="ap-modes">
          {THEMES.map((t) => (
            <button key={t} className="ap-mode" aria-pressed={theme === t}
                    onClick={() => setTheme(t)} title={t}>
              {THEME_ICON[t]}
              <span>{t}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ap-row">
        <span className="ap-k">Surface</span>
        <div className="ap-surfaces">
          {SURFACES.map((sf) => (
            <button
              key={sf.id} className="ap-surface" aria-pressed={surface === sf.id}
              onClick={() => setAppearance({ surface: sf.id })}
              title={sf.hint} aria-label={`${sf.label} — ${sf.hint}`}
            >
              <Mini {...previewFor(sf.id, resolved, shown)} />
              <span className="ap-surface-t">{sf.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ap-row">
        <span className="ap-k">
          Colour
          <b className="ap-now">{named ? named.label : `${shown}°`}</b>
        </span>
        <div className="ap-swatches">
          {ACCENTS.map((a) => (
            <button
              key={a.id} className="ap-swatch" aria-pressed={shown === a.h}
              style={{ '--sw': `oklch(0.66 0.15 ${a.h})` }}
              title={a.label} aria-label={a.label}
              onClick={() => setAppearance({ accent: a.h })}
            >
              <IconCheck />
            </button>
          ))}
        </div>
        {/* Directly under the swatches, because it is the same choice by
            another means — not a separate setting further down. */}
        <input
          className="ap-spectrum"
          type="range" min="0" max="359" value={shown} aria-label="Accent hue"
          onChange={(e) => scrub(e.target.value)}
          onPointerUp={settle}
          onPointerCancel={settle}
          onKeyUp={settle}
          onBlur={settle}
        />
      </div>

      <button className="ap-default" onClick={resetAppearance}>Back to default</button>
    </>
  );
}

/* Opened from the moon in the top bar rather than buried in Settings: this is
   the one setting people fiddle with, and it is worth seeing the app change
   behind it while you choose. */
export default function AppearanceSheet({ onClose }) {
  return (
    <Sheet title="Appearance" subtitle="How the app looks" onClose={onClose}>
      <Panel />
    </Sheet>
  );
}
