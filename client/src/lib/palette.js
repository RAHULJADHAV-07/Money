/*
 * Identity colours — a category, a person, a wallet, a savings bucket.
 *
 * All of them are stated relative to the accent rather than fixed, so choosing
 * orange in Appearance turns the wallet cards orange too. Each family is a list
 * of [lightness, chroma, hue offset] and comes back as a css `oklch()` string
 * that reads `var(--accent-h)` itself, which means these follow the accent live
 * with nothing to recompute when it changes.
 *
 * How far each family is allowed to spread depends on what its colour is for:
 *
 *   Wallet cards carry their own name on the card — CASH, UPI — so colour is
 *   decoration, and they stay within ±11° of the accent. Separation there comes
 *   almost entirely from lightness, and the floor on chroma is deliberate: the
 *   arrangement that separates best leaves two cards near-grey, which defeats
 *   the point of them following the accent at all. Holding every card above
 *   0.11 chroma costs about 0.6 ΔE2000 and is worth it. What is left is roughly
 *   5.7 ΔE under red-green colour blindness, below the 8 that colour-as-data
 *   wants — the deliberate trade being that nothing here is identified by its
 *   colour alone.
 *
 *   Chart series are the opposite — a slice means a category only because of
 *   its colour — so they spread ±45° and hold about 27 ΔE (light) and 22 ΔE
 *   (dark) between neighbours, measured across eight accents around the wheel.
 *
 * Lightness ranges differ per theme for the charts, which sit on a card, and
 * not for the wallets, which are dark blocks carrying white text either way.
 */

const css = ([L, C, dh]) => `oklch(${L} ${C} calc(var(--accent-h) + ${dh}))`;

// Chart series: eight, spread far enough apart to be told apart.
const CHART_LIGHT = [
  [0.67, 0.11, 0], [0.42, 0.14, -15], [0.67, 0.08, -30], [0.42, 0.11, -30],
  [0.67, 0.05, -30], [0.42, 0.05, -45], [0.67, 0.05, -45], [0.42, 0.14, -30],
];
const CHART_DARK = [
  [0.85, 0.11, 0], [0.60, 0.08, 15], [0.85, 0.17, 0], [0.60, 0.05, 0],
  [0.85, 0.08, 0], [0.60, 0.05, 15], [0.85, 0.05, 30], [0.60, 0.05, 45],
];

/* Wallet cards: one tight family, kept dark enough for white text. A wallet is
   an identity, not a direction, so none of these is the money-in or money-out
   colour — but they are unmistakably the accent. */
const WALLETS = [
  [0.68, 0.11, -11], [0.60, 0.17, -11], [0.52, 0.17, 11],
  [0.44, 0.11, 0],   [0.36, 0.14, 11],  [0.28, 0.17, -11],
];

const isDark = () => {
  const stamped = document.documentElement.getAttribute('data-theme');
  if (stamped) return stamped === 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
};

// A stable index per name, so the same category keeps its colour across screens.
const slotFor = (name, order, len, salt) => {
  const i = order.indexOf(name);
  const n = i >= 0 ? i : Math.abs([...String(name)].reduce((h, c) => h * 31 + c.charCodeAt(0), salt));
  return n % len;
};

export function hueFor(name, order = []) {
  const fam = isDark() ? CHART_DARK : CHART_LIGHT;
  return css(fam[slotFor(name, order, fam.length, 7)]);
}

// A soft wash of the same colour, for the surface behind an icon or an avatar.
export const softFor = (name, order = []) =>
  `color-mix(in oklab, ${hueFor(name, order)} ${isDark() ? '22%' : '13%'}, var(--surface))`;

export const walletHue = (name, order = []) => css(WALLETS[slotFor(name, order, WALLETS.length, 11)]);

/* The swatches offered when naming a savings bucket. Stated the same way, so a
   bucket chosen today still belongs to the scheme after the accent changes —
   what is saved is its offset from the accent, not a colour frozen in time. */
export const GOAL_COLORS = CHART_LIGHT.map(css);

export const initialsOf = (name) => String(name || '?').trim().slice(0, 2).toUpperCase();

// People get two letters from two words where there are two — "Ravi Kumar" → RK.
export const personInitials = (name) =>
  String(name || '?').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
