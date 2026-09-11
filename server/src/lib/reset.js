import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { jwtSecret } from './auth.js';

/*
 * Password reset links, without a table to store them in.
 *
 * The obvious design is a `password_resets` row per request, deleted when used.
 * This does the same job with no migration: the link *is* a short-lived signed
 * token, and what makes it single-use is that it carries a fingerprint of the
 * password it was issued against. Reset the password and that fingerprint no
 * longer matches, so the same link cannot be replayed -- and neither can an
 * older link that was still in the inbox.
 *
 * The fingerprint is of the bcrypt hash, never of the password, and it is
 * truncated: it only has to change when the password does, and it is handed to
 * whoever holds the email.
 *
 * An account with no password at all -- signed up through Google -- has a
 * stable fingerprint of its own, so someone who has lost access to their
 * Google account can still use this to set a password and get back in.
 */

const TTL = '45m';
const PURPOSE = 'pwreset';

const fingerprint = (user) =>
  crypto.createHash('sha256')
    .update(`${PURPOSE}:${user.password_hash || 'no-password'}`)
    .digest('hex')
    .slice(0, 16);

export const signResetToken = (user) =>
  jwt.sign({ sub: String(user.id), pur: PURPOSE, pwf: fingerprint(user) }, jwtSecret(), { expiresIn: TTL });

export class ResetError extends Error {
  constructor(message, code) { super(message); this.status = 400; this.code = code; }
}

/* Answers with the user id the link was issued for, or throws something the
   sign-in screen can show. The messages deliberately do not distinguish a
   forged token from a mistyped one. */
export function readResetToken(token) {
  let claims;
  try {
    claims = jwt.verify(String(token || ''), jwtSecret());
  } catch (err) {
    throw err?.name === 'TokenExpiredError'
      ? new ResetError('That reset link has expired. Ask for a new one.', 'RESET_EXPIRED')
      : new ResetError('That reset link is not valid. Ask for a new one.', 'RESET_INVALID');
  }
  // A session token must never double as a reset token.
  if (claims.pur !== PURPOSE || !claims.pwf) {
    throw new ResetError('That reset link is not valid. Ask for a new one.', 'RESET_INVALID');
  }
  return { userId: claims.sub, pwf: claims.pwf };
}

/** False once the password has changed since the link was sent. */
export const stillFresh = (user, pwf) => fingerprint(user) === pwf;
