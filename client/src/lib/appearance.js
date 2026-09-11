import { useEffect, useState } from 'react';

/*
 * The look of the app, in two settings.
 *
 * Lives outside the store for the same reason the theme does: the sign-in
 * screen renders before any provider, and it still has to be the right colour.
 *
 * `accent` is a hue in degrees and nothing else. Every surface, line, ink, hero
 * gradient and calendar step in styles.css is written in oklch at that hue, so
 * one number repaints the app rather than just its buttons. Lightness and
 * chroma stay put, which is what keeps a pink accent as readable as the green
 * one — oklch lightness is perceptual, so contrast does not wander with hue.
 *
 * What deliberately does NOT follow the accent: money in and money out, which
 * mean something and must not move; and the wallet-card and chart palettes,
 * which need several colours that are tellable apart. Rotating those onto one
 * hue was measured and it does not work — six shades of a single hue reach
 * about 7.3 ΔE2000 at best under red-green colour blindness, where 8 is the
 * bar the rest of the palette holds. They stay a fixed family on purpose.
 */

const KEY = 'hisab.appearance.v1';

/** Named hues, evenly spread and each a recognisable colour. */
export const ACCENTS = [
  { id: 'emerald', label: 'Emerald', h: 163 },
  { id: 'teal',    label: 'Teal',    h: 192 },
  { id: 'cyan',    label: 'Cyan',    h: 218 },
  { id: 'azure',   label: 'Azure',   h: 248 },
  { id: 'indigo',  label: 'Indigo',  h: 274 },
  { id: 'violet',  label: 'Violet',  h: 298 },
  { id: 'magenta', label: 'Magenta', h: 328 },
  { id: 'rose',    label: 'Rose',    h: 12  },
  { id: 'amber',   label: 'Amber',   h: 68  },
  { id: 'lime',    label: 'Lime',    h: 128 },
];

export const SURFACES = [
  { id: 'tinted',  label: 'Tinted',  hint: 'A trace of the accent in every panel' },
  { id: 'neutral', label: 'Neutral', hint: 'Plain greys, with the accent on the chrome alone' },
  { id: 'rich',    label: 'Rich',    hint: 'The accent carried through every surface' },
  { id: 'deep',    label: 'Deep',    hint: 'Cards lifted further off a darker canvas' },
];

export const DEFAULTS = { accent: 163, surface: 'tinted' };

/* The same two numbers each preset sets in CSS, mirrored here so the preview
   tiles can be drawn without them.

   They have to be drawn in JS, not by putting data-surface on the tile: a
   custom property is substituted where it is *declared*, and --canvas and
   friends are declared on :root. Setting --sf-c further down the tree changes
   nothing, so every tile would render identically — which is exactly what the
   first version of this did. An inline oklch() literal has no such problem. */
const PRESET = {
  neutral: { c: 0,   d: 0     },
  tinted:  { c: 1,   d: 0     },
  rich:    { c: 2.8, d: 0     },
  deep:    { c: 1.4, d: 0.030 },
};

// Lightness/chroma pairs lifted from the token blocks in styles.css.
const RAMP = {
  light: { canvas: [0.971, 0.003], surface: [1.000, 0.000], line: [0.929, 0.007] },
  dark:  { canvas: [0.145, 0.006], surface: [0.198, 0.010], line: [0.279, 0.015] },
};

/** Colours for one surface preset's preview tile, at the given mode and hue. */
export function previewFor(id, mode, hue) {
  const { c, d } = PRESET[id] || PRESET.tinted;
  const r = RAMP[mode === 'light' ? 'light' : 'dark'];
  const at = ([L, C], drop = 0) => `oklch(${(L - drop).toFixed(3)} ${(C * c).toFixed(4)} ${hue})`;
  return {
    canvas: at(r.canvas, d),
    surface: at(r.surface),
    line: at(r.line),
    accent: `oklch(${mode === 'light' ? '0.622 0.133' : '0.702 0.135'} ${hue})`,
  };
}

const clampHue = (v) => ((Math.round(Number(v)) % 360) + 360) % 360;
const isSurface = (v) => SURFACES.some((s) => s.id === v);

export function getAppearance() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      accent: Number.isFinite(Number(raw.accent)) ? clampHue(raw.accent) : DEFAULTS.accent,
      surface: isSurface(raw.surface) ? raw.surface : DEFAULTS.surface,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

const listeners = new Set();

/** Paints without saving — for dragging the hue slider. */
export function paintAppearance({ accent, surface }) {
  const root = document.documentElement;
  if (accent !== undefined) root.style.setProperty('--accent-h', String(clampHue(accent)));
  if (surface !== undefined) root.setAttribute('data-surface', surface);
}

export function setAppearance(patch) {
  const next = { ...getAppearance(), ...patch };
  next.accent = clampHue(next.accent);
  if (!isSurface(next.surface)) next.surface = DEFAULTS.surface;
  paintAppearance(next);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private window */ }
  listeners.forEach((fn) => fn(next));
  return next;
}

export const resetAppearance = () => setAppearance({ ...DEFAULTS });

/* Called once from main.jsx, before React renders. index.html stamps the same
   two values earlier still, so there is no flash of the default green on the
   way to whatever was chosen — this is the belt to that braces. */
export function initAppearance() {
  paintAppearance(getAppearance());
}

export function useAppearance() {
  const [state, setState] = useState(getAppearance);
  useEffect(() => {
    const fn = (s) => setState(s);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return state;
}
