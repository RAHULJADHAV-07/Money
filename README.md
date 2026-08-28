# My Hisab — personal money tracker

A mobile-first PWA for daily money tracking: **daily transactions, borrowed & lent,
money received, savings, and balance** — the five things you asked for, on one screen.

React (Vite) · Node/Express · Neon Postgres · Google or password sign-in · installable · works offline.

**Deploying to Render + Vercel? See [DEPLOY.md](DEPLOY.md).**

---

## 1. Fill in `server/.env`

Paste the connection string from your Neon project (**Dashboard → Connect**, the
pooled one):

```
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=verify-full
JWT_SECRET=any-long-random-string
```

The tables are created on first boot, so there is nothing to set up by hand.
Neon has no IP allow-list to configure.

## 2. Install and run

```bash
npm run install:all     # installs server + client
npm run dev             # API on :4000, app on :5173
```

Open **http://localhost:5173** and **create an account**.

Then bring in your data:

```bash
npm run seed -- your@email.com    # start with the sample buckets
```

Coming from the old MongoDB version? See **Moving from MongoDB** below.

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
| Waived off | they owed you, you agreed to drop it | — |
| Forgiven | you owed them, they dropped it | — |
| Transfer | moved between your own wallets | — |

From that one list everything else is derived:

- **Balance** = opening balance + every entry's effect above
- **Savings** = saved − withdrawn
- **To receive** = lent − got back, *per person* (one settled friend never hides another's dues)
- **To pay** = borrowed − paid back, per person
- **Net worth** = balance + savings + to receive − to pay
- **Each wallet** (Cash / UPI / Bank / Card) = its opening figure + everything that
  touched it + transfers in − transfers out. The wallets always add up to the balance.

The last three kinds move no cash. A settlement clears a debt by agreement, so what
someone owes drops but your balance does not. A transfer shifts money between your
own wallets, so the per-wallet figures change and the total stays put.

Because it is one ledger, nothing can drift out of sync the way separate sheets do.

## Accounts

Every account sees only its own money. Each transaction, savings bucket, and
settings row carries a `user_id` foreign key, and every query filters on the
signed-in user — so two people can share one deployment without seeing each
other's data.

Sign-in uses a token stored in the browser (valid 30 days), sent as an
`Authorization` header. Passwords are hashed with bcrypt and never leave the server.

There are two ways in and they reach the **same account**: an email and password,
or Continue with Google. Signing in with Google for the first time on an email
that already has an account links the two rather than making a second one — so
your ledger does not split in half. Either method can be added later under
**Settings → Ways to sign in**, and the last one standing cannot be removed.

## What is where

```
server/          Express API + SQL data layer
  src/lib/kinds.js      the ledger kinds and their cash direction — the core rule
  src/lib/auth.js       token signing + the guard on every data route
  src/lib/keepalive.js  the self-ping that stops Render's free tier sleeping
  src/routes/           auth, transactions, summary, people, goals, settings, csv
  src/schema.sql        the four tables, created on boot
  src/db.js             the Postgres pool and query helpers
  src/models/           one query module per table, plus the JSON shapes the client reads
  src/seed.js           sample data · src/migrate-from-mongo.js  one-shot import
client/          React PWA
  src/pages/            Login, Home, Ledger, People, Savings, Settings
  src/lib/api.js        API calls, auth token, offline queue
  src/lib/auth.jsx      session state
  src/components/       add sheet, transaction rows, charts
```

## Day to day

- **+ button** — add anything, from any screen. Amount first, everything else optional.
- **Home** — balance, what you owe and are owed, **where your money sits** (per wallet), spend by category, last 6 months.
- **Ledger** — every entry, grouped by day, filterable by kind and by wallet, searchable.
- **Calendar** — tap the month name anywhere to open it. Three views:
  **Day** (that date's totals and entries), **Month** (a grid shaded by daily spend,
  green dot where money came in), and **Year** (12 months with spend bars). The
  ‹ › arrows always step by whichever unit you are looking at — a day at a time in
  Day view, a month in Month view, a year in Year view.
- **People** — one row per person with a running balance; tap to settle up, in cash or
  by agreement with **Settle without payment**.
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

## Moving from MongoDB

Earlier versions stored everything in MongoDB Atlas. The data now lives in
**Neon Postgres**, in four tables: `users`, `settings`, `goals`, `transactions`
(see [server/src/schema.sql](server/src/schema.sql)). Nothing about the API or
the app changed — only what is behind it.

To bring an old Atlas database across, put both connection strings in
`server/.env` and run the one-shot import:

```bash
npm run migrate:mongo -- --dry    # read and report, write nothing
npm run migrate:mongo             # do the copy
```

It dumps the source to `server/mongo-backup-<date>.json` first, then copies
users → goals → settings → transactions and prints a row count and an amount
total for both sides so you can see they agree.

Two details worth knowing:

- **Ids are carried over unchanged.** Rows keep their original Mongo ObjectId
  as their primary key, so anyone already signed in stays signed in — their
  token still points at the same account. New rows get a UUID.
- **It is safe to re-run.** Every row is keyed by that id and skipped if it is
  already there, so a second pass copies only what is missing.

Once you have checked the numbers in the app, `MONGODB_URI` can be deleted from
`server/.env` and the Atlas cluster shut down. The app itself never reads it.

## Setting up Google sign-in

Optional — leave the two variables empty and the button simply does not appear.

**1. Make an OAuth client**

1. [console.cloud.google.com](https://console.cloud.google.com) → create or pick a project
2. **APIs & Services → OAuth consent screen** → *External* → fill in the app name,
   your support email and developer email → Save. While it stays in *Testing*,
   add every Google address that should be able to sign in under **Test users**.
   Publishing it removes that limit; a basic app needs no verification review.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
4. Application type **Web application**
5. **Authorised JavaScript origins** — the page the button is on, one entry per
   environment, scheme included and no trailing slash:

   ```
   http://localhost:5173      (vite dev)
   http://localhost:4000      (npm start, one-box mode)
   https://your-app.vercel.app
   ```

6. Leave **Authorised redirect URIs** empty — this flow never redirects.
7. Create, and copy the **Client ID** (ends in `.apps.googleusercontent.com`).

**2. Put it in both places**

The same value goes in both, or the browser will produce tokens the server
refuses:

```
client/.env    VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
server/.env    GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
```

In production that means the `VITE_GOOGLE_CLIENT_ID` build variable on Vercel
(rebuild after adding it — Vite bakes it into the bundle) and `GOOGLE_CLIENT_ID`
on Render. The Client ID is **not** a secret: it ships inside the frontend either
way. There is no client secret in this flow.

**3. Check it took**

```bash
curl https://your-api.onrender.com/api/auth/config     # -> {"google":true}
```

`{"google":false}` means the server never got `GOOGLE_CLIENT_ID`. If the button
is missing from the sign-in screen instead, the *frontend* never got
`VITE_GOOGLE_CLIENT_ID` at build time.

### How it is kept honest

The browser never tells the server who you are. It hands over the ID token
Google signed, and [server/src/lib/google.js](server/src/lib/google.js) checks
that signature against Google's published keys, checks the token was minted for
this exact client id, and refuses any address Google has not verified. A token
forged with the right issuer, audience and email is rejected before any account
is looked up.

**Common errors**

| What you see | Cause |
|---|---|
| `origin is not allowed for the given client ID` | The exact origin is missing from Authorised JavaScript origins. `localhost` and `127.0.0.1` count as different |
| The button never appears | `VITE_GOOGLE_CLIENT_ID` was unset when the frontend was built. Set it and **rebuild** |
| "Google sign-in is not configured on this server" | `GOOGLE_CLIENT_ID` missing on the API |
| "That Google sign-in could not be verified" | The two ids do not match each other |
| `403 access_denied` | Consent screen is in *Testing* and that address is not in Test users |
