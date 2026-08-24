/*
 * Mongoose creates new indexes but never removes ones that a schema change made
 * obsolete. Settings used to be a single global document keyed `key: 'default'`
 * with a unique index on it. Now there is one document per user and no `key`
 * field — so every new document has `key: null`, and the surviving unique index
 * lets exactly one of them exist. The second signup fails with E11000.
 *
 * Dropping the dead index is safe and idempotent, so it runs on every boot.
 */
const LEGACY_INDEXES = [
  { collection: 'settings', index: 'key_1' },
];

export async function repairLegacyIndexes(connection) {
  for (const { collection, index } of LEGACY_INDEXES) {
    try {
      const coll = connection.db.collection(collection);
      const existing = await coll.indexes();
      if (!existing.some((i) => i.name === index)) continue;
      await coll.dropIndex(index);
      console.log(`[migrate] dropped obsolete index ${collection}.${index}`);
    } catch (err) {
      // A missing collection or index is fine; anything else is worth seeing.
      if (err.codeName !== 'IndexNotFound' && err.codeName !== 'NamespaceNotFound') {
        console.warn(`[migrate] could not drop ${collection}.${index}: ${err.message}`);
      }
    }
  }
}
