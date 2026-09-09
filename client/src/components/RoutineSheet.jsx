import { useEffect, useState } from 'react';
import Sheet from './Sheet.jsx';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { KINDS } from '../lib/kinds.js';
import Alert from './Alert.jsx';
import { IconTrash } from './Icons.jsx';

/*
 * Setting up an entry you will make again and again.
 *
 * It is the add form with the date taken out and a rhythm put in: the date is
 * whatever day you tap it, which is the whole point of saving it here.
 */

// A transfer is left out on purpose -- moving your own money between wallets is
// not the kind of thing that wants a one-tap button on the dashboard.
const ROUTINE_KINDS = [
  'saving_in', 'expense', 'income', 'lent', 'borrowed', 'repay_paid', 'repay_received', 'saving_out',
];

const CADENCES = [
  { id: 'daily',   label: 'Every day' },
  { id: 'weekly',  label: 'Every week' },
  { id: 'monthly', label: 'Every month' },
  { id: 'yearly',  label: 'Every year' },
  { id: 'anytime', label: 'Whenever' },
];

export default function RoutineSheet({ routine, goals, people, onClose, onSaved }) {
  const { settings, notify, currency } = useStore();
  const editing = !!routine;

  const categories = settings?.categories || [];
  const sources = settings?.sources || [];
  const methods = settings?.methods?.length ? settings.methods : ['Cash', 'UPI', 'Bank', 'Card'];

  const [label, setLabel] = useState(routine?.label || '');
  const [kind, setKind] = useState(routine?.kind || 'saving_in');
  const [amount, setAmount] = useState(routine ? String(routine.amount) : '');
  const [category, setCategory] = useState(routine?.category || '');
  const [source, setSource] = useState(routine?.source || '');
  const [person, setPerson] = useState(routine?.person || '');
  const [goal, setGoal] = useState(routine?.goal?._id || '');
  const [method, setMethod] = useState(routine?.method || methods[0] || 'Cash');
  const [note, setNote] = useState(routine?.note || '');
  const [cadence, setCadence] = useState(routine?.cadence || 'daily');
  // Both optional, and independent: a start with no end, or an end with no start.
  const [startsOn, setStartsOn] = useState(routine?.startsOn || '');
  const [endsOn, setEndsOn] = useState(routine?.endsOn || '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  const needs = KINDS[kind]?.needs;
  const effCategory = category || categories[0] || 'Misc';
  const effSource = source || sources[0] || 'Other';

  // The name is what you will see on the dashboard, so it is offered rather
  // than demanded: most routines describe themselves.
  const suggested = () => {
    if (needs === 'goal') return note || 'Into savings';
    if (needs === 'category') return note || effCategory;
    if (needs === 'source') return note || effSource;
    return note || person || KINDS[kind]?.short || '';
  };
  useEffect(() => { if (!editing && !label) setLabel(''); }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const badRange = !!startsOn && !!endsOn && endsOn < startsOn;
  const ready = Number(amount) > 0 && (needs !== 'person' || person.trim())
    && (label.trim() || suggested()) && !badRange;

  async function save() {
    setSaving(true);
    setError('');
    const body = {
      label: (label.trim() || suggested()).slice(0, 60),
      kind,
      amount: Number(amount),
      method,
      note: note.trim(),
      cadence,
      startsOn: startsOn || null,
      endsOn: endsOn || null,
      category: needs === 'category' ? effCategory : '',
      source: needs === 'source' ? effSource : '',
      person: needs === 'person' ? person.trim() : '',
      goal: needs === 'goal' ? (goal || null) : null,
    };
    try {
      if (editing) await api.updateRoutine(routine._id, body);
      else await api.createRoutine(body);
      notify(editing ? 'Routine updated' : 'Routine saved');
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await api.deleteRoutine(routine._id);
      notify('Routine deleted');
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Sheet
      title={editing ? 'Edit routine' : 'New routine'}
      subtitle="One tap on the dashboard, whenever it is due"
      onClose={onClose}
    >
      {error && <div className="error-msg" role="alert">{error}</div>}

      <div className="row-2">
        <div className="field">
          <label className="field-label" htmlFor="rt-kind">What is it</label>
          <select id="rt-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
            {ROUTINE_KINDS.map((k) => <option key={k} value={k}>{KINDS[k].label}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="rt-amt">Amount</label>
          <div className="share-amt share-amt--full">
            <span>{currency}</span>
            <input
              id="rt-amt" type="number" inputMode="decimal" placeholder="0"
              value={amount} onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="row-2">
        <div className="field">
          {needs === 'goal' && (
            <>
              <label className="field-label" htmlFor="rt-goal">Savings bucket</label>
              <select id="rt-goal" className="input" value={goal} onChange={(e) => setGoal(e.target.value)}>
                <option value="">General savings</option>
                {goals.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
              </select>
            </>
          )}
          {needs === 'category' && (
            <>
              <label className="field-label" htmlFor="rt-cat">Category</label>
              <select id="rt-cat" className="input" value={effCategory} onChange={(e) => setCategory(e.target.value)}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </>
          )}
          {needs === 'source' && (
            <>
              <label className="field-label" htmlFor="rt-src">Source</label>
              <select id="rt-src" className="input" value={effSource} onChange={(e) => setSource(e.target.value)}>
                {sources.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </>
          )}
          {needs === 'person' && (
            <>
              <label className="field-label" htmlFor="rt-per">Person</label>
              <input
                id="rt-per" className="input" list="routine-people" placeholder="Name" autoComplete="off"
                value={person} onChange={(e) => setPerson(e.target.value)}
              />
              <datalist id="routine-people">
                {people.map((p) => <option key={p} value={p} />)}
              </datalist>
            </>
          )}
        </div>
        <div className="field">
          <label className="field-label" htmlFor="rt-method">Wallet</label>
          <select id="rt-method" className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            {methods.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="rt-cad">How often</label>
        <select id="rt-cad" className="input" value={cadence} onChange={(e) => setCadence(e.target.value)}>
          {CADENCES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <div className="hint">
          Only decides when it shows as due. Nothing is ever added without you tapping it.
        </div>
      </div>

      {/* A stretch of calendar the routine belongs to -- rent from the month you
          move in, a daily saving only until the wedding. Left empty, which is
          the normal case, it simply runs for good. */}
      <div className="field">
        <span className="field-label">Only between these dates <span className="field-note">optional</span></span>
        <div className="row-2">
          <input
            className="input" type="date" aria-label="First day" value={startsOn}
            onChange={(e) => setStartsOn(e.target.value)}
          />
          <input
            className="input" type="date" aria-label="Last day" value={endsOn} min={startsOn || undefined}
            onChange={(e) => setEndsOn(e.target.value)}
          />
        </div>
        {(startsOn || endsOn) && (
          <button className="btn btn--sm btn--ghost" style={{ marginTop: 10 }}
                  onClick={() => { setStartsOn(''); setEndsOn(''); }}>
            Clear dates
          </button>
        )}
        <div className="hint">
          {badRange
            ? 'The last day is before the first one.'
            : startsOn || endsOn
              ? 'Outside these days the routine stays saved, but is not offered on the dashboard.'
              : 'Leave both empty and it runs for good. Fill one in and it only shows up from — or until — that day.'}
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="rt-note">Note on each entry <span className="field-note">optional</span></label>
        <input id="rt-note" className="input" placeholder="Jar" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="rt-label">Button name <span className="field-note">optional</span></label>
        <input
          id="rt-label" className="input" placeholder={suggested() || 'Jar'}
          value={label} onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      <div className="btn-row btn-row--form">
        {editing && (
          <button className="btn btn--danger btn--icon" onClick={() => setConfirmDelete(true)} disabled={saving} aria-label="Delete routine">
            <IconTrash />
          </button>
        )}
        <button className="btn btn--primary btn--block" onClick={save} disabled={!ready || saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Save routine'}
        </button>
      </div>

      {confirmDelete && (
        <Alert
          danger tone="danger"
          title={`Delete “${routine.label}”?`}
          message="The button goes away. Every entry you already made with it stays exactly where it is."
          action="Delete" cancel="Keep it"
          onConfirm={() => { setConfirmDelete(false); remove(); }}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </Sheet>
  );
}
