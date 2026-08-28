/* Categorical hues in a fixed, validated order (adjacent-pair CVD ΔE ≥ 8 in both
   modes). Colour follows the category itself — never its rank — so filtering or
   re-sorting never repaints the survivors.

   The dark set is not the light set dimmed: each hue is re-chosen so it holds
   the same apparent weight against a near-black surface. */
const LIGHT = ['#2a6fe0', '#e2622f', '#0e9f6e', '#c98a00', '#d1569a', '#0f766e', '#6d4aca', '#d8453f'];
const DARK  = ['#5b9bff', '#f0743f', '#2fb98a', '#dfa72b', '#e97cb5', '#2bb3a6', '#a78bfa', '#f0625c'];

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
   jewel tones that never land on the money-in green or the money-out orange.
   A wallet is an identity, not a direction. */
const WALLET_LIGHT = ['#2f4a8f', '#6b3f8f', '#3f5566', '#8a4b2a', '#1c6f6a', '#9c3b5e'];
const WALLET_DARK  = ['#3f5faa', '#8055a8', '#556c80', '#a5673d', '#2a8a84', '#b85277'];

export function walletHue(name, order = []) {
  const i = order.indexOf(name);
  const slot = i >= 0 ? i : Math.abs([...String(name)].reduce((h, c) => h * 31 + c.charCodeAt(0), 11));
  return (isDark() ? WALLET_DARK : WALLET_LIGHT)[slot % 6];
}

export const initialsOf = (name) => String(name || '?').trim().slice(0, 2).toUpperCase();

// People get two letters from two words where there are two — "Ravi Kumar" → RK.
export const personInitials = (name) =>
  String(name || '?').split(/[\s-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
