/*
 * Keeping the app up to date without asking.
 *
 * The problem this solves: nobody refreshes. An installed PWA is opened, used
 * and closed, and a browser only looks for a new service worker on a
 * navigation — which a single-page app never does. So a phone can sit on a
 * build from weeks ago and never know.
 *
 * So the app asks for itself: on every launch, whenever it comes back to the
 * foreground, whenever the connection returns, and on a slow timer for the rare
 * session that stays open all day. When a new version is found it is applied
 * automatically — but the reload is handed to the app to time, because landing
 * it in the middle of a half-typed entry would throw that entry away.
 */

const EVERY = 15 * 60 * 1000;   // a long-lived session still checks now and then

let applyFn = null;
let ready = false;
let started = false;
const listeners = new Set();

const announce = () => listeners.forEach((fn) => fn(ready));

/** Called with `true` once a newer version is downloaded and waiting. */
export function onUpdateReady(fn) {
  listeners.add(fn);
  fn(ready);
  return () => listeners.delete(fn);
}

/** Hand over to the waiting version. Reloads the page. */
export const applyUpdate = () => applyFn?.(true);

export async function watchForUpdates() {
  if (started || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  started = true;

  let registerSW;
  try {
    // A virtual module, and absent when the PWA plugin is off (dev). Not having
    // it simply means there is nothing to keep up to date.
    ({ registerSW } = await import('virtual:pwa-register'));
  } catch {
    return;
  }

  applyFn = registerSW({
    immediate: true,
    onNeedRefresh() { ready = true; announce(); },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      /* An update check is a network request. Skipping it while offline keeps
         it from failing noisily every time the timer comes round. */
      const check = () => { if (navigator.onLine) registration.update().catch(() => {}); };

      setInterval(check, EVERY);
      // Reopening the app is the moment that matters most — it is the only one
      // most people ever give it.
      document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
      window.addEventListener('focus', check);
      window.addEventListener('online', check);
      check();
    },
  });
}
