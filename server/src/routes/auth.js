import { Router } from 'express';
import User from '../models/User.js';
import Settings from '../models/Settings.js';
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

  if (await User.exists({ email })) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }

  const user = await User.create({ name, email, passwordHash: await User.hash(password) });
  await Settings.load(user._id);          // give the new account its default categories
  res.status(201).json({ token: signToken(user._id), user: user.toSafeJSON() });
}));

router.post('/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const user = await User.findOne({ email });
  // Same message either way, so this can't be used to discover which emails exist.
  const ok = user && (await user.checkPassword(password));
  if (!ok) return res.status(401).json({ error: 'Wrong email or password' });

  res.json({ token: signToken(user._id), user: user.toSafeJSON() });
}));

router.get('/me', requireAuth, wrap(async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ error: 'Please sign in' });
  res.json({ user: user.toSafeJSON() });
}));

export default router;
