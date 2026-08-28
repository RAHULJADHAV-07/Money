import { useEffect, useState } from 'react';

/* Theme lives outside the store: the sign-in screen renders before any provider
   does, and it still has to be the right colour. */

const KEY = 'hisab.theme';
export const THEMES = ['system', 'light', 'dark'];

// Matches --canvas in styles.css, so the browser chrome and the page agree.
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
  if (meta) meta.setAttribute('content', CHROME[resolvedTheme(mode)]);
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
