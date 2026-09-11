/* Categorical hues in a fixed, validated order. Colour follows the category
   itself — never its rank — so filtering or re-sorting never repaints the
   survivors.

   The dark set is not the light set dimmed: each hue is re-chosen so it holds
   the same apparent weight against a near-black surface.

   Both sets are anchored on the app's green and reach outwards through teal and
   sea blue into two warms, so a chart reads as part of this app rather than as
   a box of highlighters. The stray purple, magenta and primary blue are gone.

   ── The measured property ────────────────────────────────────────────────
   Adjacent pairs are ≥ 8 ΔE2000 apart under normal, protanopic and
   deuteranopic vision — light 14.06, dark 16.44. The order is therefore load
   bearing: it was chosen by exhaustive search over all 8! arrangements, and
   shuffling these arrays would quietly undo it. The previous dark set sat at
   3.67 (its pink and its teal were all but identical to a deuteranope), so
   this is a repair as much as a retheme.

   Tritanopia is not part of the bar, as it was not before: it is ~0.01%
   prevalent, and holding it as well would force the hues apart so far that the
   family falls back to being a box of highlighters. */
const LIGHT = ['#0e9f6e', '#8a5a3c', '#c98a00', '#2d8659', '#156b84', '#4f9e3f', '#0f766e', '#e2622f'];
const DARK  = ['#2fb98a', '#dfa72b', '#4fcf9e', '#f0743f', '#2bb3a6', '#7cc45f', '#4aa7c4', '#c08a66'];

/* The swatches offered when naming a savings bucket. The same family, so a
   bucket's colour cannot land outside the scheme. Buckets already saved keep
   whatever they were given — their colour lives in the database. */
export const GOAL_COLORS = LIGHT;

const isDark = () => {
  const stamped = document.documentElement.getAttribute('data-theme');
  if (stamped) return stamped === 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
};

// A stable index per name, so the same category keeps its hue across screens.
export function hueFor(name, order = []) {
  const i = order.indexOf(name);
  const slot = i >= 0 ? i : Math.abs([...String(name)].reduce((h, c) => h * 31 + c.charCodeAt(0), 7));
  return (isDark() ? DARK : LIGHT)[slot % 8];
}

// A soft wash of the same hue, for the surface behind an icon or an avatar.
export const softFor = (name, order = []) =>
  `color-mix(in oklab, ${hueFor(name, order)} ${isDark() ? '22%' : '13%'}, var(--surface))`;

/* Wallet cards are large blocks of colour, so they get a ramp of their own:
   deep emerald through jade, teal and petrol to moss. A wallet is an identity,
   not a direction, so none of these lands on the money-in green or the
   money-out warm — but they stay inside the same family, which the old jewel
   tones did not: a navy beside a purple beside a magenta belonged to no scheme
   at all.

   Held to ALL pairs rather than adjacent ones, unlike the chart hues above,
   because any two wallets can end up side by side on the dashboard — there is
   no fixed order to lean on. Light 11.39, dark 12.66, under normal, protanopic
   and deuteranopic vision.

   That distinction is what the old ramp got wrong, and badly: its navy and its
   purple were 0.34 ΔE apart to a protanope, which is to say identical. Anyone
   red-blind could not tell one wallet card from another by colour.

   Every one is dark enough to carry white text, which is what caps the
   lightness and is why separation is bought mostly with hue. */
const WALLET_LIGHT = ['#0a5540', '#2b8c7a', '#0f6b76', '#0b4356', '#2a6d3b', '#5d9459'];
const WALLET_DARK  = ['#0c5c44', '#35a08d', '#127683', '#0e5566', '#2e7a42', '#6aa565'];

export function walletHue(name, order = []) {
  const i = order.indexOf(name);
  const slot = i >= 0 ? i : Math.abs([...String(name)].reduce((h, c) => h * 31 + c.charCodeAt(0), 11));
  return (isDark() ? WALLET_DARK : WALLET_LIGHT)[slot % 6];
}

export const initialsOf = (name) => String(name || '?').trim().slice(0, 2).toUpperCase();

// People get two letters from two words where there are two — "Ravi Kumar" → RK.
export const personInitials = (name) =>
  String(name || '?').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
