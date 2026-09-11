import { sendMail } from './mail.js';

const APP_URL = () => (process.env.APP_URL || 'https://money-dun-seven.vercel.app').replace(/\/$/, '');

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

const linkFor = (token) => `${APP_URL()}/reset-password?token=${encodeURIComponent(token)}`;

/* Table-based HTML with inline styles, like the welcome mail — Gmail strips
   <style> blocks and Outlook ignores flexbox. */
function html(name, token) {
  const url = linkFor(token);
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f6f4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f4;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e4e9e5;">
        <tr><td style="background:#0e6b4a;padding:30px 28px;">
          <div style="font:700 26px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#ffffff;">&#8377;</div>
          <div style="font:700 21px/1.3 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#ffffff;margin-top:12px;">Set a new password</div>
          <div style="font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#c9e6d9;margin-top:5px;">My Hisab</div>
        </td></tr>

        <tr><td style="padding:28px;">
          <p style="font:400 15px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0d1512;margin:0 0 20px;">
            Hi ${esc(name)}, someone asked to reset the password on your My Hisab account.
            Use the button below and you can choose a new one.
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">
            <tr><td style="background:#0e6b4a;border-radius:999px;">
              <a href="${url}" style="display:inline-block;padding:13px 28px;font:600 15px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;">Choose a new password</a>
            </td></tr>
          </table>

          <p style="font:400 13px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#4d5b55;margin:0 0 14px;">
            This link works for 45 minutes, and only once. Nothing changes until you set a new password.
          </p>
          <p style="font:400 12px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#7d8a84;margin:0;word-break:break-all;">
            If the button does not work, paste this into your browser:<br>${esc(url)}
          </p>
        </td></tr>

        <tr><td style="padding:18px 28px 26px;border-top:1px solid #e4e9e5;">
          <p style="font:400 12px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#7d8a84;margin:0;">
            If you did not ask for this, you can ignore this email — your password stays as it is,
            and the link above expires on its own.<br>
            <a href="${APP_URL()}/privacy-policy" style="color:#0e6b4a;">Privacy policy</a> &middot;
            Maintained &amp; developed by Avita Technologies
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Every HTML mail needs a text part, or spam filters treat it as a red flag.
const text = (name, token) => [
  `Hi ${name}, someone asked to reset the password on your My Hisab account.`,
  '',
  'Open this link to choose a new one:',
  linkFor(token),
  '',
  'The link works for 45 minutes, and only once.',
  'Nothing changes until you set a new password.',
  '',
  'If you did not ask for this, ignore this email — your password stays as it is.',
  `Privacy policy: ${APP_URL()}/privacy-policy`,
  'Maintained & developed by Avita Technologies',
].join('\n');

export function sendPasswordReset(user, token) {
  const name = String(user.name || '').trim().split(/\s+/)[0] || 'there';
  return sendMail({
    to: user.email,
    subject: 'Reset your My Hisab password',
    html: html(name, token),
    text: text(name, token),
  });
}
