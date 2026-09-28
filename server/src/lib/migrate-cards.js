/*
 * One-time repair of credit cards set up before 2.5.0.
 *
 * Before the card screen had a proper limit field, a credit limit was often
 * entered as if it were money — and a limit counted as money is the one error
 * that makes every other card figure wrong (₹1,99,999 "in", ₹0 owed). Two
 * shapes of it are recognisable with certainty, and only those are repaired:
 *
 *   1. The opening outstanding equals the limit (or a positive opening
 *      balance does). Nobody adds a card they have maxed out on day one —
 *      that number was the limit. The opening outstanding becomes 0.
 *
 *   2. An income entry into the card that equals its limit, or — when no limit
 *      was set — the card's very first entry being an income. That entry was
 *      the limit. It is moved to `archived_entries` (kept whole, restorable)
 *      and, where the card had no limit, becomes the limit.
 *
 * Real purchases, refunds and payments are never touched. Each account is
 * repaired once, and says so in `settings.credit_version`.
 */

const VERSION = 1;

export async function migrateCards(pool) {
  const { rows } = await pool.query(
    `select user_id from settings where credit_version < $1 and credit_cards <> '{}'::jsonb`,
    [VERSION]
  );
  for (const { user_id: userId } of rows) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const notes = await repair(client, userId);
      await client.query('commit');
      if (notes.length) console.log(`[cards] repaired ${userId}: ${notes.join('; ')}`);
    } catch (err) {
      await client.query('rollback').catch(() => {});
      console.error(`[cards] could not repair ${userId}:`, err.message);
    } finally {
      client.release();
    }
  }
  // Accounts with no cards have nothing to repair; mark them so they are not asked again.
  await pool.query(`update settings set credit_version = $1 where credit_version < $1 and credit_cards = '{}'::jsonb`, [VERSION]);
}

async function repair(db, userId) {
  const { rows: [s] } = await db.query('select * from settings where user_id = $1 for update', [userId]);
  const cards = { ...(s.credit_cards || {}) };
  const openings = { ...(s.opening_balances || {}) };
  const notes = [];

  for (const [name, raw] of Object.entries(cards)) {
    const card = { ...raw };
    let limit = Number(card.limit) || 0;
    const opening = Number(openings[name]) || 0;

    // 1. An opening figure that was really the limit.
    if (opening !== 0 && (Math.abs(opening) === limit || (opening > 0 && !limit))) {
      if (!limit) limit = Math.abs(opening);
      openings[name] = 0;
      notes.push(`${name}: opening ${opening} was the limit`);
    }

    // 2. An income entry that was really the limit.
    const { rows: incomes } = await db.query(
      `select * from transactions where user_id = $1 and method = $2 and kind = 'income' and group_id is null
        order by date asc, created_at asc`,
      [userId, name]
    );
    let suspects = [];
    if (limit > 0) {
      suspects = incomes.filter((t) => Math.abs(t.amount - limit) < 0.005);
    } else if (incomes.length === 1) {
      const { rows: [first] } = await db.query(
        `select id from transactions where user_id = $1 and (method = $2 or to_method = $2)
          order by date asc, created_at asc limit 1`,
        [userId, name]
      );
      if (first?.id === incomes[0].id) { suspects = incomes; limit = incomes[0].amount; }
    }
    for (const t of suspects) {
      await db.query(
        `insert into archived_entries (id, user_id, entry, reason) values ($1, $2, $3, $4) on conflict (id) do nothing`,
        [t.id, userId, JSON.stringify(t), `credit limit of ${name} logged as income`]
      );
      await db.query('delete from transactions where id = $1 and user_id = $2', [t.id, userId]);
      notes.push(`${name}: archived income ${t.amount} on ${t.date} (it was the limit)`);
    }

    card.limit = limit;
    cards[name] = card;
  }

  const total = Object.values(openings).reduce((n, v) => n + (Number(v) || 0), 0);
  await db.query(
    `update settings set credit_cards = $2, opening_balances = $3, opening_balance = $4, credit_version = $5, updated_at = now()
      where user_id = $1`,
    [userId, JSON.stringify(cards), JSON.stringify(openings), total, VERSION]
  );
  return notes;
}
