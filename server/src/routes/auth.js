import { Router } from 'express';
import * as User from '../models/User.js';
import * as Settings from '../models/Settings.js';
import { signToken, requireAuth } from '../lib/auth.js';
import { wrap } from '../lib/async.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  // Best-effort: settings are created on first read too, so a hiccup here must
  // not leave someone with an account they never received a token for.
  try {
    await Settings.load(user.id);
  } catch (err) {
    console.warn(`[signup] could not pre-create settings for ${email}: ${err.message}`);
  }

  res.status(201).json({ token: signToken(user.id), user: User.toSafeJSON(user) });
}));

router.post('/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const user = await User.findByEmail(email);
  // Same message either way, so this can't be used to discover which emails exist.
  const ok = user && (await User.checkPassword(user, password));
  if (!ok) return res.status(401).json({ error: 'Wrong email or password' });

  res.json({ token: signToken(user.id), user: User.toSafeJSON(user) });
}));

router.get('/me', requireAuth, wrap(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: 'Please sign in' });
  res.json({ user: User.toSafeJSON(user) });
}));

export default router;
