import { Router } from 'express';
import * as Routine from '../models/Routine.js';
import * as Transaction from '../models/Transaction.js';
import { entryFields, bad, assertOwnGoal, assertWalletCovers } from '../lib/entry.js';
import { toDayKey, dayKey, startOfToday } from '../lib/dates.js';
import { wrap } from '../lib/async.js';

const router = Router();

/*
 * Whether a routine still needs doing.
 *
 * Worked out from the day it was last tapped rather than from a schedule, so a
 * day you skip is simply a day it stays due -- nothing is silently posted to
 * catch up, and nothing is missed because a timer did not fire.
 */
export function isDue(cadence, lastDone, today) {
  if (cadence === 'anytime') return true;
  if (!lastDone) return true;
  const last = String(lastDone).slice(0, 10);
  if (cadence === 'daily') return last < today;
  if (cadence === 'monthly') return last.slice(0, 7) < today.slice(0, 7);
  if (cadence === 'yearly') return last.slice(0, 4) < today.slice(0, 4);
  // Weekly is counted in days rather than calendar weeks, so a Friday routine
  // stays a Friday routine instead of coming due again the moment a week rolls.
  const days = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${last}T00:00:00Z`)) / 86400000;
  return days >= 7;
}

/*
 * Whether a day falls inside the routine's own stretch of calendar.
 *
 * Both ends are optional and inclusive: no start means it has always applied,
 * no end means it always will. A routine outside its range is not due, is not
 * offered on the dashboard, and refuses to run -- it is dormant, not deleted.
 */
export function inRange(startsOn, endsOn, day) {
  if (startsOn && day < String(startsOn).slice(0, 10)) return false;
  if (endsOn && day > String(endsOn).slice(0, 10)) return false;
  return true;
}

function clean(body) {
  const doc = entryFields(body);
  if (doc.kind === 'transfer') throw bad('A transfer cannot be saved as a routine — add it from the ledger');

  const cadence = String(body.cadence || 'daily');
  if (!Routine.CADENCES.includes(cadence)) throw bad(`Unknown cadence "${cadence}"`);

  const label = String(body.label || '').trim().slice(0, 60);
  if (!label) throw bad('Give the routine a name so you can recognise it');

  /* Both ends are optional -- an empty box means "no bound", which is why this
     cannot go through toDayKey, whose empty case is today. */
  const startsOn = body.startsOn ? toDayKey(body.startsOn) : null;
  const endsOn = body.endsOn ? toDayKey(body.endsOn) : null;
  if (startsOn && endsOn && endsOn < startsOn) throw bad('The end date is before the start date');

  return { ...doc, cadence, label, startsOn, endsOn };
}

router.get('/', wrap(async (req, res) => {
  const today = req.query.today ? toDayKey(req.query.today) : dayKey(startOfToday());
  const rows = await Routine.listActive(req.userId);
  res.json({
    items: rows.map((r) => {
      // `active` is the range, `due` the rhythm within it: the dashboard hides
      // the first and greys the second.
      const active = inRange(r.starts_on, r.ends_on, today);
      return { ...Routine.toJSON(r), active, due: active && isDue(r.cadence, r.last_done, today) };
    }),
    today,
  });
}));

router.post('/', wrap(async (req, res) => {
  const doc = clean(req.body);
  await assertOwnGoal(doc.goal, req.userId);
  res.status(201).json(Routine.toJSON(await Routine.create(req.userId, doc)));
}));

router.put('/:id', wrap(async (req, res) => {
  const doc = clean(req.body);
  await assertOwnGoal(doc.goal, req.userId);
  const updated = await Routine.update(req.params.id, req.userId, doc);
  if (!updated) return res.status(404).json({ error: 'Routine not found' });
  res.json(Routine.toJSON(updated));
}));

router.delete('/:id', wrap(async (req, res) => {
  const gone = await Routine.remove(req.params.id, req.userId);
  if (!gone) return res.status(404).json({ error: 'Routine not found' });
  res.json({ ok: true, id: req.params.id });
}));

/*
 * Doing one.
 *
 * The saved shape is re-validated and re-checked here rather than trusted: a
 * routine written months ago may name a wallet that has since run dry, and it
 * has to be refused for exactly the same reason a typed entry would be. The
 * routine is only stamped once the entry is safely written, so a refusal leaves
 * it still due rather than marked done.
 */
router.post('/:id/run', wrap(async (req, res) => {
  const row = await Routine.findOne(req.params.id, req.userId);
  if (!row) return res.status(404).json({ error: 'Routine not found' });

  const saved = Routine.toJSON(row);
  const doc = {
    ...entryFields({ ...saved, goal: saved.goal?._id || null }),
    date: req.body?.date ? toDayKey(req.body.date) : dayKey(startOfToday()),
  };
  if (!inRange(saved.startsOn, saved.endsOn, doc.date)) {
    throw bad(
      saved.startsOn && doc.date < saved.startsOn
        ? `"${saved.label}" does not start until ${saved.startsOn}`
        : `"${saved.label}" stopped on ${saved.endsOn}`
    );
  }
  await assertOwnGoal(doc.goal, req.userId);
  await assertWalletCovers(req.userId, doc);

  const tx = await Transaction.create(req.userId, doc);
  await Routine.markDone(req.params.id, req.userId, doc.date);
  res.status(201).json({ entry: Transaction.toJSON(tx), routine: { ...saved, lastDone: doc.date, due: false } });
}));

export default router;
