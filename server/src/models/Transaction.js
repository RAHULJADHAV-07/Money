import { one, many } from '../db.js';
import { DEBT_KINDS } from '../lib/kinds.js';

/* Every read joins the bucket, so `goal` always comes back as the small object
   the client renders ({_id, name, color}) rather than a bare id. */
const SELECT = `
  select t.*, g.name as goal_name, g.color as goal_color
    from transactions t
    left join goals g on g.id = t.goal_id`;

export const toJSON = (t) => ({
  _id: t.id,
  user: t.user_id,
  date: t.date,
  kind: t.kind,
  amount: t.amount,
  category: t.category,
  source: t.source,
  person: t.person,
  goal: t.goal_id ? { _id: t.goal_id, name: t.goal_name ?? null, color: t.goal_color ?? null } : null,
  note: t.note,
  method: t.method,
  toMethod: t.to_method,
  createdAt: t.created_at,
  updatedAt: t.updated_at,
});

// A search term is matched literally: LIKE's own wildcards must not leak in.
const escapeLike = (q) => String(q).replace(/[\\%_]/g, (c) => `\\${c}`);

/* Builds the shared WHERE for the list and its count, so the two can never
   drift apart and disagree about how many results there are. */
function buildWhere(userId, f) {
  const values = [userId];
  const conds = ['t.user_id = $1'];
  const p = (v) => { values.push(v); return `$${values.length}`; };

  if (f.from) conds.push(`t.date >= ${p(f.from)}`);
  if (f.to) conds.push(`t.date <= ${p(f.to)}`);
  if (f.before) conds.push(`t.date < ${p(f.before)}`);
  if (f.kind) conds.push(`t.kind = ${p(f.kind)}`);
  if (f.kinds?.length) conds.push(`t.kind = any(${p(f.kinds)})`);
  if (f.person) conds.push(`t.person = ${p(f.person)}`);
  if (f.category) conds.push(`t.category = ${p(f.category)}`);
  if (f.method) {
    const m = p(f.method);
    conds.push(`(t.method = ${m} or t.to_method = ${m})`);
  }
  if (f.q) {
    const like = p(`%${escapeLike(f.q)}%`);
    conds.push(`(t.note ilike ${like} or t.person ilike ${like} or t.category ilike ${like} or t.source ilike ${like})`);
  }

  return { where: conds.join(' and '), values };
}

export async function list(userId, filters, { limit, skip }) {
  const { where, values } = buildWhere(userId, filters);
  const [items, counted] = await Promise.all([
    many(
      `${SELECT} where ${where} order by t.date desc, t.created_at desc limit $${values.length + 1} offset $${values.length + 2}`,
      [...values, limit, skip]
    ),
    one(`select count(*)::int as total from transactions t where ${where}`, values),
  ]);
  return { items, total: counted.total };
}

export const findOne = (id, userId) =>
  one(`${SELECT} where t.id = $1 and t.user_id = $2`, [id, userId]);

export async function create(userId, doc) {
  const row = await one(
    `insert into transactions (user_id, date, kind, amount, category, source, person, goal_id, note, method, to_method)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) returning id`,
    [userId, doc.date, doc.kind, doc.amount, doc.category, doc.source, doc.person, doc.goal, doc.note, doc.method, doc.toMethod]
  );
  return findOne(row.id, userId);
}

export async function update(id, userId, doc) {
  const row = await one(
    `update transactions set date = $3, kind = $4, amount = $5, category = $6, source = $7,
            person = $8, goal_id = $9, note = $10, method = $11, to_method = $12, updated_at = now()
      where id = $1 and user_id = $2 returning id`,
    [id, userId, doc.date, doc.kind, doc.amount, doc.category, doc.source, doc.person, doc.goal, doc.note, doc.method, doc.toMethod]
  );
  return row ? findOne(row.id, userId) : null;
}

export const remove = (id, userId) =>
  one('delete from transactions where id = $1 and user_id = $2 returning id', [id, userId]);

export const recent = (userId, limit) =>
  many(`${SELECT} where t.user_id = $1 order by t.date desc, t.created_at desc limit $2`, [userId, limit]);

export const allForExport = (userId) =>
  many(`${SELECT} where t.user_id = $1 order by t.date asc, t.created_at asc`, [userId]);

export const personHistory = (userId, person) =>
  many(
    `${SELECT} where t.user_id = $1 and t.person = $2 and t.kind = any($3)
      order by t.date desc, t.created_at desc`,
    [userId, person, DEBT_KINDS]
  );

/* ── Aggregates ────────────────────────────────────────────────────────────
   Each of these is one round trip. Where two views differ only by date window
   they are UNIONed under a `scope` tag rather than queried twice.            */

// All-time, this month and today, in one pass.
export const kindTotals = (userId, monthStart, monthEnd, day) =>
  many(
    `select scope, kind, sum(amount) as total, count(*)::int as count from (
        select 'all' as scope, kind, amount from transactions where user_id = $1
        union all
        select 'month', kind, amount from transactions where user_id = $1 and date >= $2 and date < $3
        union all
        select 'day', kind, amount from transactions where user_id = $1 and date = $4
     ) x group by scope, kind`,
    [userId, monthStart, monthEnd, day]
  );

// Per-wallet movement, all-time and this month.
export const methodTotals = (userId, monthStart, monthEnd) =>
  many(
    `select scope, method, kind, sum(amount) as total, count(*)::int as count from (
        select 'all' as scope, method, kind, amount from transactions where user_id = $1
        union all
        select 'month', method, kind, amount from transactions where user_id = $1 and date >= $2 and date < $3
     ) x group by scope, method, kind`,
    [userId, monthStart, monthEnd]
  );

// Where the month's money went, and where it came from.
export const categoryAndSource = (userId, monthStart, monthEnd) =>
  many(
    `select 'category' as dim, category as name, sum(amount) as total, count(*)::int as count
       from transactions where user_id = $1 and kind = 'expense' and date >= $2 and date < $3
      group by category
     union all
     select 'source', source, sum(amount), count(*)::int
       from transactions where user_id = $1 and kind = 'income' and date >= $2 and date < $3
      group by source
     order by total desc`,
    [userId, monthStart, monthEnd]
  );

export const monthlyTrend = (userId, from, to) =>
  many(
    `select to_char(date, 'YYYY-MM') as month, kind, sum(amount) as total
       from transactions where user_id = $1 and date >= $2 and date < $3
      group by 1, 2`,
    [userId, from, to]
  );

export const personTotals = (userId) =>
  many(
    `select person, kind, sum(amount) as total, max(date) as last, count(*)::int as count
       from transactions
      where user_id = $1 and kind = any($2) and person <> ''
      group by person, kind`,
    [userId, DEBT_KINDS]
  );

// Transfers, keyed by the wallet the money landed in.
export const transferIn = (userId) =>
  many(
    `select to_method, to_char(date, 'YYYY-MM') as month, sum(amount) as total
       from transactions where user_id = $1 and kind = 'transfer' and to_method <> ''
      group by 1, 2`,
    [userId]
  );

export const byDay = (userId, from, to) =>
  many(
    `select date::text as day, kind, sum(amount) as total, count(*)::int as count
       from transactions where user_id = $1 and date >= $2 and date < $3
      group by 1, 2`,
    [userId, from, to]
  );

export const byMonth = (userId, from, to) =>
  many(
    `select to_char(date, 'YYYY-MM') as month, kind, sum(amount) as total, count(*)::int as count
       from transactions where user_id = $1 and date >= $2 and date < $3
      group by 1, 2`,
    [userId, from, to]
  );
