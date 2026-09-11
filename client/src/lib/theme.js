import { useEffect, useState } from 'react';

/* Theme lives outside the store: the sign-in screen renders before any provider
   does, and it still has to be the right colour. */

const KEY = 'hisab.theme';
export const THEMES = ['system', 'light', 'dark'];

/* Only a fallback now. The real value is read off the page below: --canvas is
   oklch at whatever accent is chosen, so a hardcoded pair here would drift the
   moment someone picked a different one. */
const CHROME = { light: '#f4f6f4', dark: '#080b0a' };

const listeners = new Set();
const mq = () => window.matchMedia?.('(prefers-color-scheme: dark)');

export function getTheme() {
  try {
    const v = localStorage.getItem(KEY);
    return THEMES.includes(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

export function resolvedTheme(mode = getTheme()) {
  if (mode !== 'system') return mode;
  return mq()?.matches ? 'dark' : 'light';
}

function paintChrome(mode) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  /* Asked of the page rather than stated here. body carries `background:
     var(--canvas)`, and a computed background always resolves to rgb() — which
     theme-color understands, where oklch() is not reliably supported. */
  let paint = '';
  try {
    const bg = getComputedStyle(document.body).backgroundColor;
    if (bg && bg !== 'transparent' && !bg.startsWith('rgba(0, 0, 0, 0')) paint = bg;
  } catch { /* fall through to the pair above */ }
  meta.setAttribute('content', paint || CHROME[resolvedTheme(mode)]);
}

export function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  try { localStorage.setItem(KEY, mode); } catch { /* ignore */ }
  paintChrome(mode);
  listeners.forEach((fn) => fn(mode));
}

// Following the OS while it flips needs a live listener, not just a first read.
mq()?.addEventListener?.('change', () => {
  if (getTheme() === 'system') {
    paintChrome('system');
    listeners.forEach((fn) => fn('system'));
  }
});

export function useTheme() {
  const [mode, setMode] = useState(getTheme);

  useEffect(() => {
    const fn = (m) => setMode(m);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  return [mode, applyTheme, resolvedTheme(mode)];
}
