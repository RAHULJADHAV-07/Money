# Deploying My Hisab

Backend → **Render** (free). Frontend → **Vercel** (free). Database → **Neon Postgres** (free).

Do these in order — each step needs a URL from the one before it.

---

## 0. Push to GitHub

Both hosts deploy from a repo.

```bash
cd ~/Desktop/Money
git init
git add .
git commit -m "My Hisab v1.0.0"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/my-hisab.git
git push -u origin main
```

`.gitignore` already excludes `node_modules`, `dist`, and `.env`, so your password
and secrets stay off GitHub. **Check that `server/.env` is not in the commit** —
`git status` should never list it.

---

## 1. Neon — get the connection string

1. [console.neon.tech](https://console.neon.tech) → your project → **Connect**
2. Copy the **pooled** connection string (the host ends in `-pooler`). Pooling
   matters on Render's free tier, where the service restarts often.
3. Keep `sslmode=verify-full` on the end of it.

There is no IP allow-list to configure — Neon accepts connections from anywhere
and relies on the password plus TLS. The four tables are created automatically
the first time the API boots, so there is no schema to load by hand.

---

## 2. Backend on Render

1. [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**
2. Connect your GitHub repo
3. Settings:

| Field | Value |
|---|---|
| Name | `hisab-api` |
| Root Directory | `server` |
| Runtime | Node |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | Free |

4. **Environment Variables** — add these:

| Key | Value |
|---|---|
| `DATABASE_URL` | your pooled Neon string, real password, `?sslmode=verify-full` on the end |
| `JWT_SECRET` | a long random string (below) |
| `NODE_ENV` | `production` |

Generate the secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> `JWT_SECRET` is what signs your login tokens. If it is missing the server
> refuses to start in production, on purpose — a default secret would let anyone
> forge a login. If you ever change it, everyone gets signed out. That's expected.

5. **Create Web Service**. When it goes live, copy the URL —
   something like `https://hisab-api.onrender.com`.
6. Check it: open `https://hisab-api.onrender.com/api/health` → `{"ok":true,...}`

*(There's a `render.yaml` in the repo root if you'd rather use a Blueprint.)*

---

## 3. Frontend on Vercel

1. [vercel.com/new](https://vercel.com/new) → import the same repo
2. Settings:

| Field | Value |
|---|---|
| Framework Preset | Vite |
| Root Directory | `client` |
| Build Command | `npm run build` *(default)* |
| Output Directory | `dist` *(default)* |

3. **Environment Variables** — add one:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://hisab-api.onrender.com` *(no trailing slash)* |

4. **Deploy**. You'll get `https://my-hisab.vercel.app`.

> `VITE_API_URL` is baked in at **build** time, not read at runtime. Change it
> later and you must **redeploy**, not just restart.

---

## 4. Point the backend back at the frontend (CORS)

Until you do this, the browser blocks every API call.

Render → your service → **Environment** → add:

| Key | Value |
|---|---|
| `CORS_ORIGINS` | `https://my-hisab.vercel.app` |
| `ALLOW_VERCEL_PREVIEWS` | `true` *(optional — lets preview deploys work too)* |

Save. Render redeploys automatically.

---

## 5. Turn on the keep-alive

Render free **spins down after 15 minutes without an inbound request**, and the
next visit then takes ~50 seconds to wake up.

Render → **Environment** → add:

| Key | Value |
|---|---|
| `SELF_URL` | `https://hisab-api.onrender.com` *(this service's own URL)* |
| `KEEPALIVE_MINUTES` | `10` |

The server then calls its **own** `/api/health` every 10 minutes, which counts as
inbound traffic and keeps it awake. You'll see it in the Render logs:

```
[keepalive] pinging https://hisab-api.onrender.com/api/health every 10 min
[keepalive] 200 in 143ms
```

### Two things to know about this

**Pinging the frontend would not have worked.** Render measures *inbound* requests
to your service. A request going *out* to Vercel doesn't reset the idle timer.
And Vercel never sleeps anyway — it's a static site on a CDN, so there is nothing
to keep awake. The self-ping is the piece that does the job.

**The self-ping can't wake a service that's already asleep** — the timer dies with
the process. After a deploy or a crash it stays down until someone visits. If you
want it bulletproof, add a free external pinger as a backstop:

- [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com)
- URL: `https://hisab-api.onrender.com/api/health`, every 10 minutes

**Watch your free hours.** Render gives 750 instance-hours/month. Staying awake
24/7 costs ~730, so one always-on free service just fits — but a second one won't.
To turn the ping off, set `KEEPALIVE=off`.

---

## 6. First run

1. Open your Vercel URL → **Create account**
2. Install it: Chrome address bar → install icon → **My Hisab**

### Bringing your existing data across

Already have data in the old MongoDB Atlas database? Copy it over **locally**,
with both `DATABASE_URL` and `MONGODB_URI` set in `server/.env`:

```bash
npm run migrate:mongo -- --dry    # read and report, write nothing
npm run migrate:mongo             # do the copy
```

```
[migrate] inserted  users 7/7  goals 3/3  settings 3/3  transactions 45/45
[verify] amount total  mongo 54569  postgres 54569  MATCH
```

Accounts come across with their passwords and their ids, so you sign in exactly
as before. It is safe to re-run — rows already copied are skipped. Once the
numbers look right in the app, drop `MONGODB_URI` and shut the cluster down.

To start fresh with the sample buckets instead: `npm run seed -- your@email.com`.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| "blocked by CORS policy" in console | `CORS_ORIGINS` missing/mismatched on Render. Must match the Vercel URL exactly — `https://`, no trailing slash |
| All API calls 404, or hit your Vercel URL | `VITE_API_URL` unset at build time. Set it and **redeploy** |
| "Could not connect to database" in Render logs | `DATABASE_URL` is missing, or the password isn't URL-encoded |
| Server won't boot: "JWT_SECRET must be set" | Add `JWT_SECRET` in Render |
| First visit takes ~50s | Service was asleep. Confirm `SELF_URL` is set and check logs for `[keepalive]` |
| Everyone signed out after a deploy | `JWT_SECRET` changed. Sign in again |
| Password has `@`, `#`, `/` | URL-encode it in `DATABASE_URL` (`@`→`%40`, `#`→`%23`, `/`→`%2F`) |
| `self signed certificate` / TLS error at boot | The connection string lost its `?sslmode=verify-full` |
