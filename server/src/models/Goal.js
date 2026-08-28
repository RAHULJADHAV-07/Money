import { one, many } from '../db.js';

export const toJSON = (g) => ({
  _id: g.id,
  user: g.user_id,
  name: g.name,
  target: g.target,
  color: g.color,
  archived: g.archived,
  createdAt: g.created_at,
  updatedAt: g.updated_at,
});

export const listActive = (userId) =>
  many('select * from goals where user_id = $1 and archived = false order by created_at asc', [userId]);

export const findByName = (userId, name) =>
  one('select * from goals where user_id = $1 and name = $2', [userId, name]);

export const ownedBy = async (id, userId) =>
  !!(await one('select 1 from goals where id = $1 and user_id = $2', [id, userId]));

export const create = ({ userId, name, target, color }) =>
  one(
    'insert into goals (user_id, name, target, color) values ($1, $2, $3, $4) returning *',
    [userId, name, target, color]
  );

/* Only the keys present in `patch` are touched, so a rename never resets a
   target the client did not send. */
export function update(id, userId, patch) {
  const cols = { name: 'name', target: 'target', color: 'color', archived: 'archived' };
  const sets = [];
  const values = [];
  for (const [key, col] of Object.entries(cols)) {
    if (patch[key] === undefined) continue;
    values.push(patch[key]);
    sets.push(`${col} = $${values.length}`);
  }
  if (!sets.length) return one('select * from goals where id = $1 and user_id = $2', [id, userId]);

  sets.push('updated_at = now()');
  values.push(id, userId);
  return one(
    `update goals set ${sets.join(', ')} where id = $${values.length - 1} and user_id = $${values.length} returning *`,
    values
  );
}

export const remove = (id, userId) =>
  one('delete from goals where id = $1 and user_id = $2 returning id', [id, userId]);

// Saved-per-bucket, plus whatever was saved without picking one.
export const savedTotals = (userId) =>
  many(
    `select goal_id, kind, sum(amount) as total
       from transactions
      where user_id = $1 and kind in ('saving_in', 'saving_out')
      group by goal_id, kind`,
    [userId]
  );
