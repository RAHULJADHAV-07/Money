import 'dotenv/config';
import mongoose from 'mongoose';
import { connect } from './db.js';
import User from './models/User.js';
import Transaction from './models/Transaction.js';
import Goal from './models/Goal.js';
import Settings from './models/Settings.js';

/*
 * Data created before accounts existed has no `user` field, so it would be
 * invisible once every query is scoped to a user. This hands all of it to one
 * account. Run once, after signing up:
 *
 *   npm run adopt -- you@example.com
 */
const email = (process.argv[2] || '').trim().toLowerCase();

async function run() {
  if (!email) {
    console.error('Usage: npm run adopt -- your@email.com');
    process.exit(1);
  }

  await connect(process.env.MONGODB_URI);

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`No account found for ${email}. Sign up in the app first, then re-run this.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const orphaned = { user: { $exists: false } };
  const [tx, goals] = await Promise.all([
    Transaction.updateMany(orphaned, { $set: { user: user._id } }),
    Goal.updateMany(orphaned, { $set: { user: user._id } }),
  ]);

  // Old settings were a single global doc keyed 'default'; give it to this user.
  const legacy = await Settings.collection.findOne({ user: { $exists: false } });
  if (legacy) {
    const alreadyMine = await Settings.collection.findOne({ user: user._id });
    if (alreadyMine) await Settings.collection.deleteOne({ _id: legacy._id });
    else await Settings.collection.updateOne({ _id: legacy._id }, { $set: { user: user._id }, $unset: { key: '' } });
  }

  console.log(`[adopt] ${tx.modifiedCount} transactions -> ${email}`);
  console.log(`[adopt] ${goals.modifiedCount} savings buckets -> ${email}`);
  console.log(`[adopt] settings ${legacy ? 'migrated' : 'already per-user'}`);
  await mongoose.disconnect();
  console.log('[adopt] done');
}

run().catch((err) => { console.error('[adopt] ' + err.message); process.exit(1); });
