/*
 * Loads Google Identity Services on demand.
 *
 * The script is fetched the first time a Google button is drawn rather than in
 * index.html, so signing in with a password never pays for it — and the app
 * still starts normally when Google is unreachable.
 *
 * The client id is public by design: it identifies the app to Google and ships
 * in this bundle. The server is what actually verifies the token.
 */
const SRC = 'https://accounts.google.com/gsi/client';

export const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
export const googleEnabled = () => !!googleClientId;

let pending = null;

export function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);

  pending ||= new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SRC;
    el.async = true;
    el.defer = true;
    el.onload = () => (window.google?.accounts?.id
      ? resolve(window.google)
      : reject(new Error('Google sign-in did not load properly — please refresh')));
    // A failed load must not be cached as "done", or a retry could never work.
    el.onerror = () => { pending = null; el.remove(); reject(new Error('Could not reach Google — check your connection')); };
    document.head.appendChild(el);
  });

  return pending;
}

// After signing out, Google should not silently offer the same account again.
export function forgetGoogleSession() {
  try { window.google?.accounts?.id?.disableAutoSelect?.(); } catch { /* not loaded yet */ }
}
