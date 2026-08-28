/*
 * Outbound mail through Brevo's HTTP API.
 *
 * An HTTP call rather than SMTP on purpose: no ports to be blocked by a host,
 * no TLS negotiation, no connection pool to hold open, and a JSON error back
 * when something is wrong instead of a numeric SMTP code.
 *
 * Two things must be true in your Brevo account before anything sends:
 *   1. the account is phone-verified (Brevo blocks all sending until it is)
 *   2. MAIL_FROM's address is a *verified sender* under Senders, Domains & IPs
 *
 * Everything here is best-effort. Mail must never decide whether a signup
 * succeeds — someone who created an account and got no welcome note still has
 * an account, and telling them otherwise would be a lie.
 */
const ENDPOINT = () => process.env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email';

const apiKey = () => (process.env.BREVO_API_KEY || '').trim();

export const mailEnabled = () => !!apiKey();

// "My Hisab <hi@example.com>" -> { name: 'My Hisab', email: 'hi@example.com' }
export function sender() {
  const raw = (process.env.MAIL_FROM || '').trim();
  const named = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (named) return { name: named[1].replace(/^["']|["']$/g, '') || 'My Hisab', email: named[2].trim() };
  return { name: 'My Hisab', email: raw };
}

// Brevo's own message is the useful part; these add what to actually do about it.
function explain(status, body) {
  const detail = body?.message || body?.error || 'no detail given';
  /* Brevo answers 401 both for a bad key and for a good key called from an
     address outside its IP allowlist. They need very different fixes, so they
     get very different messages. */
  if (status === 401 && /ip address/i.test(detail)) {
    return 'Brevo blocked this server\'s IP address. Either turn off the IP restriction at '
      + 'app.brevo.com/security/authorised_ips, or add this address to it — note that Render\'s '
      + `free tier has no fixed outbound IP, so the restriction has to be off in production (${detail})`;
  }
  if (status === 401) return `Brevo rejected the API key — check BREVO_API_KEY (${detail})`;
  if (status === 400 && /sender/i.test(detail)) {
    return `Brevo will not send from that address — add it under Senders, Domains & IPs and verify it (${detail})`;
  }
  if (status === 402 || /credit/i.test(detail)) return `Brevo is out of sending credit (${detail})`;
  return `Brevo refused the message (${status}: ${detail})`;
}

export async function sendMail({ to, subject, html, text }) {
  if (!mailEnabled()) {
    console.log(`[mail] not configured — skipping "${subject}" to ${to}`);
    return null;
  }

  const from = sender();
  if (!from.email) throw new Error('MAIL_FROM is not set, so there is no address to send from');

  const res = await fetch(ENDPOINT(), {
    method: 'POST',
    headers: {
      'api-key': apiKey(),
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: from,
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
    // A hung mail call must not sit on a request forever.
    signal: AbortSignal.timeout(Number(process.env.MAIL_TIMEOUT_MS || 15000)),
  });

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(explain(res.status, body));

  console.log(`[mail] sent "${subject}" to ${to}${body?.messageId ? ` (${body.messageId})` : ''}`);
  return body;
}
