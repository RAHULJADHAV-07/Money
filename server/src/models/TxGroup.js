import { one, tx } from '../db.js';
import * as Transaction from './Transaction.js';

/*
 * A split entry: one real event, several ledger meanings.
 *
 * The group row records only what actually changed hands -- `received` and
 * `paid`. Everything with a meaning lives in `transactions` as an ordinary
 * part, so the dashboard, the wallet balances and the People page all count a
 * split correctly without knowing splits exist.
 */

export const toJSON = (g, parts = []) => ({
  _id: g.id,
  user: g.user_id,
  date: g.date,
  title: g.title,
  note: g.note,
  received: g.received,
  paid: g.paid,
  total: g.total,
  form: g.form || {},
  parts: parts.map(Transaction.toJSON),
  createdAt: g.created_at,
  updatedAt: g.updated_at,
});

const writeParts = async (c, userId, groupId, date, parts) => {
  for (const p of parts) {
    await c.one(Transaction.INSERT_PART, Transaction.partValues(userId, groupId, { ...p, date }));
  }
};

export const findRow = (id, userId) =>
  one('select * from tx_groups where id = $1 and user_id = $2', [id, userId]);

export async function findOne(id, userId) {
  const g = await findRow(id, userId);
  return g ? toJSON(g, await Transaction.partsOf(id, userId)) : null;
}

/* Group and parts land together or not at all: a half-written split would be a
   set of loose entries that no longer add up to anything. */
export async function create(userId, doc) {
  const id = await tx(async (c) => {
    const g = await c.one(
      `insert into tx_groups (user_id, date, title, note, received, paid, total, form)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [userId, doc.date, doc.title, doc.note, doc.received, doc.paid, doc.total, doc.form]
    );
    await writeParts(c, userId, g.id, doc.date, doc.parts);
    return g.id;
  });
  return findOne(id, userId);
}

/* Parts are rewritten wholesale rather than diffed. Nothing references a part
   by id, and replacing the set is the only way an edit can be sure the saved
   split still reconciles -- a diff that missed a row would leave one that does
   not. */
export async function update(id, userId, doc) {
  const ok = await tx(async (c) => {
    const g = await c.one(
      `update tx_groups set date = $3, title = $4, note = $5, received = $6, paid = $7,
              total = $8, form = $9, updated_at = now()
        where id = $1 and user_id = $2 returning id`,
      [id, userId, doc.date, doc.title, doc.note, doc.received, doc.paid, doc.total, doc.form]
    );
    if (!g) return false;
    await c.query('delete from transactions where group_id = $1 and user_id = $2', [id, userId]);
    await writeParts(c, userId, id, doc.date, doc.parts);
    return true;
  });
  return ok ? findOne(id, userId) : null;
}

// The parts go with it -- `on delete cascade` on transactions.group_id.
export const remove = (id, userId) =>
  one('delete from tx_groups where id = $1 and user_id = $2 returning id', [id, userId]);
