import { Router } from 'express';
import * as User from '../models/User.js';
import * as Settings from '../models/Settings.js';
import { signToken, requireAuth, optionalUserId } from '../lib/auth.js';
import { verifyGoogleToken, googleEnabled } from '../lib/google.js';
import { wrap } from '../lib/async.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Settings are created on first read too, so a hiccup here must not leave
// someone with an account they never received a token for.
async function preCreateSettings(user) {
  try {
    await Settings.load(user.id);
  } catch (err) {
    console.warn(`[auth] could not pre-create settings for ${user.email}: ${err.message}`);
  }
}

// Lets the sign-in screen know whether to draw the Google button at all.
router.get('/config', (req, res) => res.json({ google: googleEnabled() }));

router.post('/signup', wrap(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!name) return res.status(400).json({ error: 'Please enter your name' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  if (await User.emailTaken(email)) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const user = await User.create({ name, email, passwordHash: await User.hash(password) });
  await preCreateSettings(user);

  res.status(201).json({ token: signToken(user.id), user: User.toSafeJSON(user) });
}));

router.post('/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const user = await User.findByEmail(email);

  /* Someone who signed up with Google has no password, and telling them "wrong
     email or password" would send them round in circles forever. Signup already
     discloses which emails exist, so being cagey here would buy nothing. */
  if (user && !user.password_hash) {
    return res.status(401).json({
      error: 'This account signs in with Google — use the Continue with Google button',
    });
  }

  // Same message either way, so this can't be used to discover which emails exist.
  const ok = user && (await User.checkPassword(user, password));
  if (!ok) return res.status(401).json({ error: 'Wrong email or password' });

  res.json({ token: signToken(user.id), user: User.toSafeJSON(user) });
}));

/*
 * One endpoint, two jobs, decided by whether a valid app token came along:
 *   signed out  →  sign in, or create the account, or land on the existing one
 *                  that already owns this verified email
 *   signed in   →  connect Google to the account being used right now
 */
router.post('/google', wrap(async (req, res) => {
  const profile = await verifyGoogleToken(String(req.body.credential || ''));
  const linkTo = optionalUserId(req);

  const { user, outcome } = await User.resolveGoogleIdentity(profile, { linkTo });
  if (outcome === 'created') await preCreateSettings(user);

  res.status(outcome === 'created' ? 201 : 200).json({
    token: signToken(user.id),
    user: User.toSafeJSON(user),
    outcome,
  });
}));

// Disconnecting is only safe once there is another way in.
router.delete('/google', requireAuth, wrap(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: 'Please sign in' });
  if (!user.google_id) return res.status(400).json({ error: 'Google is not connected to this account' });
  if (!user.password_hash) {
    return res.status(400).json({
      error: 'Set a password first, or you would have no way left to sign in',
    });
  }
  res.json({ user: User.toSafeJSON(await User.unlinkGoogle(user.id)) });
}));

/* Sets the first password on a Google account, or changes an existing one.
   Changing needs the current password; setting the first one cannot, because
   there is nothing yet to prove — the signed-in token is the proof. */
router.put('/password', requireAuth, wrap(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: 'Please sign in' });

  const password = String(req.body.password || '');
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  if (user.password_hash) {
    const ok = await User.checkPassword(user, String(req.body.currentPassword || ''));
    if (!ok) return res.status(400).json({ error: 'Your current password is not right' });
  }

  const updated = await User.setPasswordHash(user.id, await User.hash(password));
  res.json({ user: User.toSafeJSON(updated) });
}));

router.get('/me', requireAuth, wrap(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: 'Please sign in' });
  res.json({ user: User.toSafeJSON(user) });
}));

export default router;
