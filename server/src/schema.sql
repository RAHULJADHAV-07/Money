-- Hisab on Postgres (Neon).
--
-- Ids are TEXT rather than UUID on purpose: the rows carried over from MongoDB
-- keep their original ObjectId strings, so nothing that already holds an id --
-- a signed-in phone's JWT included -- stops matching after the move. New rows
-- get a UUID string from the default below.

create table if not exists users (
  id            text primary key default gen_random_uuid()::text,
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists goals (
  id         text primary key default gen_random_uuid()::text,
  user_id    text not null references users(id) on delete cascade,
  name       text not null,
  target     double precision not null default 0,
  color      text not null default '#2f9e6f',
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists settings (
  id               text primary key default gen_random_uuid()::text,
  user_id          text not null unique references users(id) on delete cascade,
  currency         text not null default '₹',
  opening_balance  double precision not null default 0,
  categories       text[] not null default '{Housing,Food,Transport,Utilities,Entertainment,Health,Shopping,Misc}',
  sources          text[] not null default '{Salary,Freelance,Investment,Mom,Dad,Other}',
  methods          text[] not null default '{Cash,UPI,Bank,Card}',
  -- Free-form maps: category -> monthly budget, wallet -> what it held on day one.
  budgets          jsonb not null default '{}'::jsonb,
  opening_balances jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- `date` is a calendar day, not an instant: money tracking has no clock time,
-- and a DATE column cannot drift across timezones the way a timestamp can.
create table if not exists transactions (
  id         text primary key default gen_random_uuid()::text,
  user_id    text not null references users(id) on delete cascade,
  date       date not null,
  kind       text not null,
  amount     double precision not null check (amount >= 0),
  category   text not null default '',
  source     text not null default '',
  person     text not null default '',
  -- Deleting a bucket keeps its entries; they fall back to unassigned savings.
  goal_id    text references goals(id) on delete set null,
  note       text not null default '',
  method     text not null default 'Cash',
  to_method  text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/* ── Google sign-in ────────────────────────────────────────────────────────
   An account can hold a password, a linked Google identity, or both, and the
   two reach the same data. These run as ALTERs rather than being folded into
   the CREATE above so that a database made by an earlier version picks them
   up on its next boot. All three are idempotent.                            */
alter table users add column if not exists google_id  text;
alter table users add column if not exists avatar_url text;

-- Postgres allows many NULLs under a unique index, so password-only accounts
-- are unaffected while a Google id can still belong to exactly one account.
create unique index if not exists users_google_id_key on users (google_id);

-- An account created through Google has no password to store.
alter table users alter column password_hash drop not null;

create index if not exists goals_user_idx        on goals (user_id);
create index if not exists tx_user_date_idx      on transactions (user_id, date desc, created_at desc);
create index if not exists tx_user_kind_idx      on transactions (user_id, kind);
create index if not exists tx_user_person_idx    on transactions (user_id, person, kind);

/* ── Split entries ─────────────────────────────────────────────────────────
   One real-world event whose money means several things at once — a shared
   bill you paid with someone else's cash, a repayment that came back with a
   little extra on top. The group holds what actually changed hands; its parts
   are ordinary rows in `transactions`, each with its own true kind.

   The group deliberately lives in its own table rather than as a parent row in
   `transactions`. Every aggregate in the app sums transaction rows by kind, so
   a container row sitting among them would have to be excluded from each one,
   forever — and a single missed exclusion silently double-counts money. Kept
   apart, the parts are just rows, and every existing total stays correct.     */
create table if not exists tx_groups (
  id         text primary key default gen_random_uuid()::text,
  user_id    text not null references users(id) on delete cascade,
  date       date not null,
  title      text not null default '',
  note       text not null default '',
  -- What came into your hand, and what left it. The parts must add up to these.
  received   double precision not null default 0 check (received >= 0),
  paid       double precision not null default 0 check (paid >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table transactions add column if not exists group_id text;

/* A part belongs to its group for life: deleting the split deletes its parts.
   The constraint is added on its own rather than inline above, because
   `add column if not exists` skips the entire statement -- REFERENCES clause
   included -- on a database that already has the column, which would leave the
   parts of a split with nothing tying them to it. Guarded by name, so this
   repairs such a database on its next boot instead of failing on a duplicate. */
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'transactions_group_id_fkey') then
    alter table transactions
      add constraint transactions_group_id_fkey
      foreign key (group_id) references tx_groups(id) on delete cascade;
  end if;
end $$;

/* The headline figure the event actually had -- the bill, or the amount handed
   over. `received`/`paid` are what the parts must reconcile to, which is not
   always the same number: a bill someone else paid moves no cash of yours, yet
   the bill was still 1645. */
alter table tx_groups add column if not exists total double precision not null default 0;

/* What you typed, kept beside what it was turned into.
   The parts are the ledger and stay the single source of truth for every total.
   This is the other half: the answers you gave -- the bill, who paid, each
   share -- so reopening a split shows you your own words again instead of the
   ledger rows it derived. Nothing is ever computed from it. */
alter table tx_groups add column if not exists form jsonb not null default '{}'::jsonb;

create index if not exists tx_groups_user_idx on tx_groups (user_id, date desc);
create index if not exists tx_group_idx       on transactions (group_id);

/* ── Routines ──────────────────────────────────────────────────────────────
   An entry you make over and over -- a hundred rupees into the jar, every day.
   The routine is only a saved shape; nothing posts on its own. You tap it, you
   confirm, and an ordinary entry is written. `last_done` is the day you last
   tapped it, which is what decides whether it still needs doing today.        */
create table if not exists routines (
  id         text primary key default gen_random_uuid()::text,
  user_id    text not null references users(id) on delete cascade,
  label      text not null default '',
  kind       text not null,
  amount     double precision not null check (amount > 0),
  category   text not null default '',
  source     text not null default '',
  person     text not null default '',
  goal_id    text references goals(id) on delete set null,
  note       text not null default '',
  method     text not null default 'Cash',
  to_method  text not null default '',
  -- daily | weekly | monthly | yearly | anytime
  cadence    text not null default 'daily',
  last_done  date,
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists routines_user_idx on routines (user_id, archived, created_at);

/* An optional stretch of calendar a routine belongs to -- a rent that starts in
   October, a daily saving you only want through the festival month. Either end
   may be null, which simply means "no bound that way". Outside the range the
   routine is not due and is not offered on the dashboard; it is left alone
   rather than deleted, so the same shape can be handed a new range later.
   Added as ALTERs so a database made by an earlier version picks them up. */
alter table routines add column if not exists starts_on date;
alter table routines add column if not exists ends_on   date;
