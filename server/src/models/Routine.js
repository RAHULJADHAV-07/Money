import { one, many } from '../db.js';

/*
 * A saved entry you make again and again.
 *
 * Nothing here posts on its own -- a routine is a shape plus a rhythm. Tapping
 * it writes an ordinary transaction through exactly the same rules as the add
 * form, and stamps `last_done`, which is the only thing that decides whether it
 * still needs doing.
 */

export const CADENCES = ['daily', 'weekly', 'monthly', 'yearly', 'anytime'];

const SELECT = `
  select r.*, g.name as goal_name, g.color as goal_color
    from routines r
    left join goals g on g.id = r.goal_id`;

export const toJSON = (r) => ({
  _id: r.id,
  label: r.label,
  kind: r.kind,
  amount: r.amount,
  category: r.category,
  source: r.source,
  person: r.person,
  goal: r.goal_id ? { _id: r.goal_id, name: r.goal_name ?? null, color: r.goal_color ?? null } : null,
  note: r.note,
  method: r.method,
  toMethod: r.to_method,
  cadence: r.cadence,
  lastDone: r.last_done,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const listActive = (userId) =>
  many(`${SELECT} where r.user_id = $1 and r.archived = false order by r.created_at asc`, [userId]);

export const findOne = (id, userId) =>
  one(`${SELECT} where r.id = $1 and r.user_id = $2`, [id, userId]);

const VALUES = (userId, d) =>
  [userId, d.label, d.kind, d.amount, d.category, d.source, d.person, d.goal, d.note, d.method, d.toMethod, d.cadence];

export async function create(userId, doc) {
  const row = await one(
    `insert into routines (user_id, label, kind, amount, category, source, person, goal_id, note, method, to_method, cadence)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id`,
    VALUES(userId, doc)
  );
  return findOne(row.id, userId);
}

export async function update(id, userId, doc) {
  const row = await one(
    `update routines set label = $3, kind = $4, amount = $5, category = $6, source = $7, person = $8,
            goal_id = $9, note = $10, method = $11, to_method = $12, cadence = $13, updated_at = now()
      where id = $1 and user_id = $2 returning id`,
    [id, userId, ...VALUES(userId, doc).slice(1)]
  );
  return row ? findOne(row.id, userId) : null;
}

// Stamped only once the entry it writes has actually been accepted.
export const markDone = (id, userId, day) =>
  one(
    'update routines set last_done = $3, updated_at = now() where id = $1 and user_id = $2 returning id',
    [id, userId, day]
  );

export const remove = (id, userId) =>
  one('delete from routines where id = $1 and user_id = $2 returning id', [id, userId]);
