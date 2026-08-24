import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from './db.js';
import auth from './routes/auth.js';
import transactions from './routes/transactions.js';
import summary from './routes/summary.js';
import people from './routes/people.js';
import goals from './routes/goals.js';
import settings from './routes/settings.js';
import exportRoutes from './routes/export.js';
import { requireAuth } from './lib/auth.js';
import { startKeepAlive } from './lib/keepalive.js';
import { KINDS } from './lib/kinds.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// The PWA is served from Vercel while the API lives on Render, so the browser
// sends cross-origin requests. Only the origins listed here may call the API.
const allowed = (process.env.CORS_ORIGINS || '')
  .split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);                    // curl, health checks, same-origin
    if (!allowed.length) return cb(null, true);            // unset = permissive, for local dev
    const clean = origin.replace(/\/$/, '');
    if (allowed.includes(clean)) return cb(null, true);
    // Allow Vercel preview deployments of the same project when asked to.
    if (process.env.ALLOW_VERCEL_PREVIEWS === 'true' && /^https:\/\/[\w-]+\.vercel\.app$/.test(clean)) {
      return cb(null, true);
    }
    cb(new Error(`Origin ${origin} is not allowed by CORS`));
  },
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()), time: new Date().toISOString() });
});
app.get('/api/kinds', (req, res) => res.json(KINDS));

app.use('/api/auth', auth);

// Everything below this line requires a signed-in user.
app.use('/api/transactions', requireAuth, transactions);
app.use('/api/summary', requireAuth, summary);
app.use('/api/people', requireAuth, people);
app.use('/api/goals', requireAuth, goals);
app.use('/api/settings', requireAuth, settings);
app.use('/api/export', requireAuth, exportRoutes);

// When running as one box (npm start), the API also serves the built PWA.
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api\/).*/, (req, res, next) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => (err ? next() : null));
});

app.use((err, req, res, next) => {
  const status = err.status || (/CORS/.test(err.message) ? 403 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Something went wrong' });
});

const PORT = process.env.PORT || 4000;
connect(process.env.MONGODB_URI)
  .then(() => app.listen(PORT, () => {
    console.log(`[api] listening on ${PORT}`);
    if (allowed.length) console.log(`[cors] allowing ${allowed.join(', ')}`);
    startKeepAlive();
  }))
  .catch((err) => {
    console.error('[db] ' + err.message);
    process.exit(1);
  });
