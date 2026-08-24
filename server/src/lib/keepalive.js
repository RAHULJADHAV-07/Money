/*
 * Render's free tier spins a service down after ~15 minutes without an INBOUND
 * request. An outbound call (e.g. pinging the frontend) does not count — so the
 * ping that actually works is the service calling its own public URL.
 *
 * Vercel does not need this: the frontend is served from a CDN and never sleeps.
 */
const INTERVAL_MS = Number(process.env.KEEPALIVE_MINUTES || 10) * 60 * 1000;

export function startKeepAlive() {
  const url = process.env.SELF_URL;
  if (!url) {
    console.log('[keepalive] SELF_URL not set — skipping (fine for local dev)');
    return null;
  }
  if (process.env.KEEPALIVE === 'off') {
    console.log('[keepalive] disabled via KEEPALIVE=off');
    return null;
  }

  const target = `${url.replace(/\/$/, '')}/api/health`;
  console.log(`[keepalive] pinging ${target} every ${INTERVAL_MS / 60000} min`);

  const ping = async () => {
    try {
      const started = Date.now();
      const res = await fetch(target, {
        headers: { 'x-keepalive': '1' },
        signal: AbortSignal.timeout(20000),
      });
      console.log(`[keepalive] ${res.status} in ${Date.now() - started}ms`);
    } catch (err) {
      console.warn(`[keepalive] ping failed: ${err.message}`);
    }
  };

  const timer = setInterval(ping, INTERVAL_MS);
  timer.unref?.();               // never hold the process open just for this
  setTimeout(ping, 30_000);      // first ping once the service is warm
  return timer;
}
