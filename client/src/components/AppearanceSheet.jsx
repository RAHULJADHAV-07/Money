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
  const named = ACCENTS.find((a) => a.h === accent);

  /* Dragging paints without saving, so a scrub across the spectrum does not
     write to storage on every frame; the commit happens on release. */
  const scrub = (h) => paintAppearance({ accent: Number(h) });
  const commit = (h) => setAppearance({ accent: Number(h) });

  return (
    <>
      <div className="ap-reset"><button className="card-action" onClick={resetAppearance}>Reset</button></div>

      <div className="ap-label">Colour mode</div>
      <div className="theme-picker">
        {THEMES.map((t) => (
          <button key={t} className="theme-opt" aria-pressed={theme === t} onClick={() => setTheme(t)}>
            <span className={`theme-swatch theme-swatch--${t}`} aria-hidden="true" />
            <span className="theme-opt-ico">{THEME_ICON[t]}</span>
            <span className="theme-opt-label">{t}</span>
          </button>
        ))}
      </div>

      <div className="ap-label ap-label--lead">Surfaces</div>
      <div className="ap-surfaces">
        {SURFACES.map((s) => (
          <button
            key={s.id} className="ap-surface" aria-pressed={surface === s.id}
            onClick={() => setAppearance({ surface: s.id })}
          >
            {/* Drawn from literal colours, not from data-surface: see previewFor. */}
            <Mini {...previewFor(s.id, resolved, accent)} />
            <span className="ap-surface-t">{s.label}</span>
            <span className="ap-surface-h">{s.hint}</span>
          </button>
        ))}
      </div>

      <div className="ap-label ap-label--lead">
        Accent
        <span className="ap-now">{named ? named.label : `${accent}°`}</span>
      </div>
      <div className="ap-swatches">
        {ACCENTS.map((a) => (
          <button
            key={a.id} className="ap-swatch" aria-pressed={accent === a.h}
            style={{ '--sw': `oklch(0.66 0.15 ${a.h})` }}
            title={a.label} aria-label={a.label}
            onClick={() => setAppearance({ accent: a.h })}
          >
            <IconCheck />
          </button>
        ))}
      </div>

      <label className="ap-spectrum">
        <span className="ap-spectrum-t">Anything else</span>
        <input
          type="range" min="0" max="359" value={accent} aria-label="Accent hue"
          onChange={(e) => scrub(e.target.value)}
          onPointerUp={(e) => commit(e.target.value)}
          onKeyUp={(e) => commit(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
        />
      </label>

      <p className="hint">
        The accent carries through every surface, button and gradient. Money in and
        money out keep their own colours — they mean something — and so do the
        wallet cards and charts, which need several colours you can tell apart.
      </p>
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
