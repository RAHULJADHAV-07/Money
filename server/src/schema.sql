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
