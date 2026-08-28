import { one } from '../db.js';

export const toJSON = (s) => ({
  _id: s.id,
  user: s.user_id,
  currency: s.currency,
  openingBalance: s.opening_balance,
  categories: s.categories,
  sources: s.sources,
  methods: s.methods,
  budgets: s.budgets,
  openingBalances: s.opening_balances,
  createdAt: s.created_at,
  updatedAt: s.updated_at,
});

/* Read first, create only if missing: settings are read on every dashboard
   load, and an unconditional upsert would rewrite the row each time. */
export async function load(userId) {
  const found = await one('select * from settings where user_id = $1', [userId]);
  if (found) return found;
  return one(
    `insert into settings (user_id) values ($1)
     on conflict (user_id) do update set user_id = excluded.user_id
     returning *`,
    [userId]
  );
}

export async function save(userId, patch) {
  const cols = {
    currency: 'currency',
    categories: 'categories',
    sources: 'sources',
    methods: 'methods',
    budgets: 'budgets',
    openingBalances: 'opening_balances',
    openingBalance: 'opening_balance',
  };
  const sets = [];
  const values = [userId];
  for (const [key, col] of Object.entries(cols)) {
    if (patch[key] === undefined) continue;
    values.push(key === 'budgets' || key === 'openingBalances' ? JSON.stringify(patch[key]) : patch[key]);
    sets.push(`${col} = $${values.length}`);
  }
  if (!sets.length) return load(userId);

  sets.push('updated_at = now()');
  return one(`update settings set ${sets.join(', ')} where user_id = $1 returning *`, values);
}
