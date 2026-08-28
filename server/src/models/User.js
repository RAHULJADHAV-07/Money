import bcrypt from 'bcryptjs';
import { one } from '../db.js';

export const hash = (plain) => bcrypt.hash(plain, 10);

/* A Google-only account has no hash at all; comparing against it must answer
   "no" rather than throwing, or a password attempt would be a 500. */
export const checkPassword = (user, plain) =>
  (user?.password_hash ? bcrypt.compare(plain, user.password_hash) : Promise.resolve(false));

// Never let the hash escape in an API response. `hasPassword` and `google` tell
// the app which ways in this account has, so Settings can offer the other one.
export const toSafeJSON = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  avatarUrl: u.avatar_url || null,
  hasPassword: !!u.password_hash,
  google: u.google_id ? { connected: true } : { connected: false },
  createdAt: u.created_at,
});

export const findByEmail = (email) => one('select * from users where email = $1', [email]);

export const findById = (id) => one('select * from users where id = $1', [id]);

export const findByGoogleId = (googleId) => one('select * from users where google_id = $1', [googleId]);

export const emailTaken = async (email) => !!(await one('select 1 from users where email = $1', [email]));

export const create = ({ name, email, passwordHash }) =>
  one(
    'insert into users (name, email, password_hash) values ($1, $2, $3) returning *',
    [name, email, passwordHash]
  );

export const createWithGoogle = ({ name, email, googleId, avatarUrl }) =>
  one(
    `insert into users (name, email, password_hash, google_id, avatar_url)
     values ($1, $2, null, $3, $4) returning *`,
    [name, email, googleId, avatarUrl]
  );

// An avatar is only filled in, never blanked, so a picture Google stops sending
// does not silently wipe the one already on the account.
export const linkGoogle = (userId, googleId, avatarUrl) =>
  one(
    `update users set google_id = $2, avatar_url = coalesce($3, avatar_url), updated_at = now()
      where id = $1 returning *`,
    [userId, googleId, avatarUrl]
  );

export const unlinkGoogle = (userId) =>
  one('update users set google_id = null, updated_at = now() where id = $1 returning *', [userId]);

export const setPasswordHash = (userId, passwordHash) =>
  one('update users set password_hash = $2, updated_at = now() where id = $1 returning *', [userId, passwordHash]);

/*
 * Turns a verified Google profile into an account, and reports which of the
 * four things happened so the route can pick the right status code and the
 * caller can be told what changed.
 *
 *   linkTo  the already-signed-in user, when this is "connect Google to my
 *           account" rather than "sign me in"
 *
 * Matching on email is what makes one identity out of two sign-in methods: the
 * address is verified by Google before it reaches here, so landing on the
 * existing account is safe, and it is what stops a duplicate account appearing
 * the first time someone taps the Google button.
 */
export async function resolveGoogleIdentity(profile, { linkTo = null } = {}) {
  const byGoogle = await findByGoogleId(profile.googleId);

  if (linkTo) {
    if (byGoogle && byGoogle.id !== linkTo) {
      throw Object.assign(
        new Error('That Google account is already connected to a different My Hisab account'),
        { status: 409 }
      );
    }
    if (byGoogle) return { user: byGoogle, outcome: 'already-linked' };
    const me = await findById(linkTo);
    if (!me) throw Object.assign(new Error('Please sign in'), { status: 401 });
    return { user: await linkGoogle(me.id, profile.googleId, profile.avatarUrl), outcome: 'linked' };
  }

  if (byGoogle) return { user: byGoogle, outcome: 'signed-in' };

  const byEmail = await findByEmail(profile.email);
  if (byEmail) {
    return { user: await linkGoogle(byEmail.id, profile.googleId, profile.avatarUrl), outcome: 'linked' };
  }

  return { user: await createWithGoogle(profile), outcome: 'created' };
}
