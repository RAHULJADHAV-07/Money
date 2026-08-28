import { sendMail } from './mail.js';

const APP_URL = () => (process.env.APP_URL || 'https://money-dun-seven.vercel.app').replace(/\/$/, '');

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

const POINTS = [
  ['Log it in seconds', 'Amount first, everything else optional. The + button works from any screen.'],
  ['Never lose track of a loan', 'Money you lent and money you borrowed, netted off per person.'],
  ['Save with a purpose', 'Put money aside into buckets with targets you can actually reach.'],
  ['Works without signal', 'Entries you add offline sync themselves the moment you are back online.'],
];

/* Plain table-based HTML with inline styles, because that is what mail clients
   render reliably — Gmail strips <style> blocks, and Outlook ignores flexbox. */
function html(name) {
  const rows = POINTS.map(([title, body]) => `
    <tr>
      <td style="padding:0 0 18px;">
        <div style="font:600 15px/1.4 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0d1512;">${esc(title)}</div>
        <div style="font:400 14px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#4d5b55;margin-top:3px;">${esc(body)}</div>
      </td>
    </tr>`).join('');

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f6f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f4;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e4e9e5;">
        <tr><td style="background:#0e6b4a;padding:30px 28px;">
          <div style="font:700 26px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">₹</div>
          <div style="font:700 21px/1.3 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#ffffff;margin-top:12px;">Welcome to My Hisab</div>
          <div style="font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#c9e6d9;margin-top:5px;">Every rupee, accounted for.</div>
        </td></tr>

        <tr><td style="padding:28px;">
          <p style="font:400 15px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0d1512;margin:0 0 22px;">
            Hi ${esc(name)}, your account is ready. Here is what you can do with it:
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
            <tr><td style="background:#0e6b4a;border-radius:999px;">
              <a href="${APP_URL()}" style="display:inline-block;padding:13px 28px;font:600 15px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;">Open My Hisab</a>
            </td></tr>
          </table>

          <p style="font:400 13px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#7d8a84;margin:24px 0 0;">
            Tip: add it to your home screen and it behaves like a proper app — full screen, and it opens instantly.
          </p>
        </td></tr>

        <tr><td style="padding:18px 28px 26px;border-top:1px solid #e4e9e5;">
          <p style="font:400 12px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#7d8a84;margin:0;">
            You are getting this because an account was created with this email address at My Hisab.
            If that was not you, just reply and we will remove it.<br>
            <a href="${APP_URL()}/privacy-policy" style="color:#0e6b4a;">Privacy policy</a> ·
            Maintained &amp; developed by Avita Technologies
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Every HTML mail needs a text part, or spam filters treat it as a red flag.
function text(name) {
  return [
    `Hi ${name}, welcome to My Hisab.`,
    '',
    'Your account is ready. With it you can:',
    ...POINTS.map(([t, b]) => `  • ${t} — ${b}`),
    '',
    `Open the app: ${APP_URL()}`,
    '',
    'Tip: add it to your home screen and it behaves like a proper app.',
    '',
    'You are getting this because an account was created with this email address',
    'at My Hisab. If that was not you, just reply and we will remove it.',
    `Privacy policy: ${APP_URL()}/privacy-policy`,
    'Maintained & developed by Avita Technologies',
  ].join('\n');
}

export function sendWelcome(user) {
  const name = String(user.name || '').trim().split(/\s+/)[0] || 'there';
  return sendMail({
    to: user.email,
    subject: 'Welcome to My Hisab',
    html: html(name),
    text: text(name),
  });
}
