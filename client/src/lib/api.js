// Same-origin '/api' locally (Vite proxies it); an absolute URL once the frontend
// is on Vercel and the API on Render.
const BASE = `${(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}/api`;
const OUTBOX = 'hisab.outbox.v1';
const TOKEN_KEY = 'hisab.token';

export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t) => { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } };

// Set by the auth provider so an expired token bounces the user to the login screen.
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

const readOutbox = () => { try { return JSON.parse(localStorage.getItem(OUTBOX) || '[]'); } catch { return []; } };
const writeOutbox = (q) => { try { localStorage.setItem(OUTBOX, JSON.stringify(q)); } catch { /* storage full or blocked */ } };

const listeners = new Set();
export const onOutboxChange = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const announce = () => listeners.forEach((fn) => fn(readOutbox().length));

export const pendingCount = () => readOutbox().length;
export const pendingWrites = () => readOutbox();

async function raw(path, { method = 'GET', body, signal, skipAuthRedirect } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(BASE + path, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (res.status === 401 && !skipAuthRedirect) onUnauthorized();
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.code);
  return data;
}

export const get = (path, opts) => raw(path, opts);

// Writes survive a dead connection: they queue locally and replay on reconnect.
async function mutate(path, method, body) {
  try {
    return await raw(path, { method, body });
  } catch (err) {
    const offline = err instanceof TypeError || !navigator.onLine;
    if (!offline) throw err;
    const queue = readOutbox();
    queue.push({ id: `q${Date.now()}${Math.random().toString(36).slice(2, 7)}`, path, method, body, queuedAt: Date.now() });
    writeOutbox(queue);
    announce();
    return { queued: true, ...body };
  }
}

export const post = (path, body) => mutate(path, 'POST', body);
export const put = (path, body) => mutate(path, 'PUT', body);
export const del = (path) => mutate(path, 'DELETE');

let flushing = false;
export async function flushOutbox() {
  if (flushing || !navigator.onLine) return { sent: 0, failed: 0 };
  const queue = readOutbox();
  if (!queue.length) return { sent: 0, failed: 0 };

  flushing = true;
  let sent = 0, failed = 0;
  const left = [];
  for (const item of queue) {
    try {
      await raw(item.path, { method: item.method, body: item.body });
      sent++;
    } catch (err) {
      // A rejected write is dropped — replaying it forever would wedge the queue.
      if (err instanceof ApiError && err.status >= 400 && err.status < 500) { failed++; continue; }
      left.push(item);
    }
  }
  writeOutbox(left);
  announce();
  flushing = false;
  return { sent, failed, left: left.length };
}

export const auth = {
  signup: (body) => raw('/auth/signup', { method: 'POST', body, skipAuthRedirect: true }),
  login: (body) => raw('/auth/login', { method: 'POST', body, skipAuthRedirect: true }),
  me: () => raw('/auth/me', { skipAuthRedirect: true }),
  // Whether the server has Google configured — handy for checking a deployment.
  config: () => raw('/auth/config', { skipAuthRedirect: true }),
  /* One call for both jobs. Signed out it signs in or creates the account;
     signed in the token goes along and connects Google to that account. */
  google: (credential) => raw('/auth/google', { method: 'POST', body: { credential }, skipAuthRedirect: true }),
  disconnectGoogle: () => raw('/auth/google', { method: 'DELETE' }),
  setPassword: (body) => raw('/auth/password', { method: 'PUT', body }),
};

export const api = {
  summary: (month, today) => get(`/summary?month=${month}&today=${today}`),
  /* Just the wallet balances, for checking an entry against the wallet paying
     for it. `exclude` leaves out the entry being edited, so its own old amount
     is not counted against its new one. */
  wallets: (exclude) => get(`/summary/wallets${exclude ? `?exclude=${encodeURIComponent(exclude)}` : ''}`),
  calendar: (month) => get(`/summary/calendar?month=${month}`),
  yearSummary: (year) => get(`/summary/year?year=${year}`),
  transactions: (params) => get(`/transactions?${new URLSearchParams(params)}`),
  createTx: (body) => post('/transactions', body),
  updateTx: (id, body) => put(`/transactions/${id}`, body),
  deleteTx: (id) => del(`/transactions/${id}`),
  people: () => get('/people'),
  person: (name) => get(`/people/${encodeURIComponent(name)}`),
  goals: () => get('/goals'),
  createGoal: (body) => post('/goals', body),
  updateGoal: (id, body) => put(`/goals/${id}`, body),
  deleteGoal: (id) => del(`/goals/${id}`),
  settings: () => get('/settings'),
  saveSettings: (body) => put('/settings', body),
  exportUrl: () => `${BASE}/export/csv`,
};
