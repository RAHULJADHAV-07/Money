import jwt from 'jsonwebtoken';

const DEFAULT_DEV_SECRET = 'hisab-dev-secret-change-me';

export function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  // A missing secret in production would silently make every token forgeable.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return DEFAULT_DEV_SECRET;
}

export const signToken = (userId) =>
  jwt.sign({ sub: String(userId) }, jwtSecret(), { expiresIn: '30d' });

// Guards every data route: no valid token, no data.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Please sign in' });

  try {
    req.userId = jwt.verify(token, jwtSecret()).sub;
    next();
  } catch {
    res.status(401).json({ error: 'Your session expired — please sign in again' });
  }
}
