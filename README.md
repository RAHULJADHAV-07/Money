# My Hisab — personal money tracker

A mobile-first PWA for daily money tracking: **daily transactions, borrowed & lent,
money received, savings, and balance** — the five things you asked for, on one screen.

React (Vite) · Node/Express · MongoDB Atlas · accounts · installable · works offline.

**Deploying to Render + Vercel? See [DEPLOY.md](DEPLOY.md).**

---

## 1. Fill in `server/.env`

Replace `<db_password>` with your real Atlas password:

```
MONGODB_URI=mongodb+srv://Cluster0:YOUR_PASSWORD@cluster0.shect.mongodb.net/hisab?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=any-long-random-string
```

If the password contains `@ : / ? # [ ] %`, URL-encode it (`@` → `%40`, `#` → `%23`).
In Atlas, also allow your IP under **Network Access**.

## 2. Install and run

```bash
npm run install:all     # installs server + client
npm run dev             # API on :4000, app on :5173
```

Open **http://localhost:5173** and **create an account**.

Then bring in your data:

```bash
npm run adopt -- your@email.com   # claims data created before accounts existed
npm run seed  -- your@email.com   # or: start with the sample buckets
```

## 3. Install it as an app

```bash
npm start               # builds the app and serves everything from :4000
```

Open **http://localhost:4000** (not `:5173` — the dev server has no service worker,
so Chrome won't offer to install it). Click the install icon in the address bar.
It installs as **My Hisab**.

> Home-screen install needs HTTPS or localhost. `http://192.168.x.x` won't offer it.
> For your phone, either deploy ([DEPLOY.md](DEPLOY.md)) or tunnel:
> `npx cloudflared tunnel --url http://localhost:4000`

---

## How the numbers work

Every entry is one row in a single ledger, and each kind declares what it does to
your cash:

| You choose | Means | Cash in hand |
|---|---|---|
| Expense | you spent | ↓ |
| Income | you got paid | ↑ |
| Lent | you gave someone money | ↓ (they now owe you) |
| Borrowed | someone gave you money | ↑ (you now owe them) |
| Got back | they repaid you | ↑ (their debt shrinks) |
| Paid back | you repaid them | ↓ (your debt shrinks) |
| Saved | moved into savings | ↓ |
| Withdrew | taken out of savings | ↑ |

From that one list everything else is derived:

- **Balance** = opening balance + every entry's effect above
- **Savings** = saved − withdrawn
- **To receive** = lent − got back, *per person* (one settled friend never hides another's dues)
- **To pay** = borrowed − paid back, per person
- **Net worth** = balance + savings + to receive − to pay

Because it is one ledger, nothing can drift out of sync the way separate sheets do.

## Accounts

Every account sees only its own money. Each transaction, savings bucket, and
settings document carries a `user` id, and every query filters on the signed-in
user — so two people can share one deployment without seeing each other's data.

Sign-in uses a token stored in the browser (valid 30 days), sent as an
`Authorization` header. Passwords are hashed with bcrypt and never leave the server.

## What is where

```
server/          Express API + Mongoose models
  src/lib/kinds.js      the ledger kinds and their cash direction — the core rule
  src/lib/auth.js       token signing + the guard on every data route
  src/lib/keepalive.js  the self-ping that stops Render's free tier sleeping
  src/routes/           auth, transactions, summary, people, goals, settings, csv
  src/seed.js           sample data · src/adopt.js  claims pre-account data
client/          React PWA
  src/pages/            Login, Home, Ledger, People, Savings, Settings
  src/lib/api.js        API calls, auth token, offline queue
  src/lib/auth.jsx      session state
  src/components/       add sheet, transaction rows, charts
```

## Day to day

- **+ button** — add anything, from any screen. Amount first, everything else optional.
- **Home** — balance, what you owe and are owed, spend by category, last 6 months.
- **Ledger** — every entry, grouped by day, filterable and searchable.
- **People** — one row per person with a running balance; tap to settle up.
- **Savings** — buckets like Emergency fund or Trip, each with a target.
- **Settings** — categories, income sources, budgets, theme, and **CSV export**.

### Offline

Entries added without a connection are saved on the device and marked *waiting to
sync*; they upload automatically when you are back online. Your last loaded data
stays readable offline too.

### Carried over from your spreadsheets

`npm run seed` brings in what you already had, so you do not start from zero:

- Debt ledger — MRM-Money ₹8,469 borrowed, MOM Help ₹5,700 lent
- Income — the ₹86 opening row
- Categories and income sources from *Personal Money CheckUp*
- Savings buckets (Emergency Fund, Trip Fund, Health Insurance) from *Hisab_Structure*

It is safe to run more than once — it only fills in what is missing.
