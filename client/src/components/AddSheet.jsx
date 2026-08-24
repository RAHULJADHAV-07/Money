import { useEffect, useMemo, useState } from 'react';
import Sheet from './Sheet.jsx';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { KINDS, ADD_ORDER } from '../lib/kinds.js';
import { todayKey } from '../lib/format.js';

const TONE_OF = (kind) => KINDS[kind]?.tone || 'out';

export default function AddSheet() {
  const { addSheet, closeAdd, settings, refresh, notify, currency } = useStore();
  const editing = addSheet?.tx || null;

  const [kind, setKind] = useState(addSheet?.kind || 'expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [person, setPerson] = useState(addSheet?.person || '');
  const [goal, setGoal] = useState(addSheet?.goal || '');
  const [date, setDate] = useState(todayKey);
  const [method, setMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [goals, setGoals] = useState([]);
  const [people, setPeople] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.goals().then((g) => setGoals(g.items)).catch(() => {});
    api.people().then((p) => setPeople(p.people.map((x) => x.person))).catch(() => {});
  }, []);

  // Seed the form from the entry being edited, or from where the sheet was opened.
  useEffect(() => {
    if (editing) {
      setKind(editing.kind);
      setAmount(String(editing.amount));
      setCategory(editing.category || '');
      setSource(editing.source || '');
      setPerson(editing.person || '');
      setGoal(editing.goal?._id || editing.goal || '');
      setDate(String(editing.date).slice(0, 10));
      setMethod(editing.method || 'Cash');
      setNote(editing.note || '');
    } else {
      if (addSheet?.kind) setKind(addSheet.kind);
      if (addSheet?.person) setPerson(addSheet.person);
      if (addSheet?.goal) setGoal(addSheet.goal);
    }
  }, [editing, addSheet]);

  const needs = KINDS[kind]?.needs;
  const categories = settings?.categories || [];
  const sources = settings?.sources || [];
  const methods = settings?.methods || ['Cash', 'UPI', 'Bank', 'Card'];

  // Resolved at render time, not in an effect — an effect racing the "seed from
  // the entry being edited" effect above would overwrite the entry's own value.
  const effCategory = category || categories[0] || 'Misc';
  const effSource = source || sources[0] || 'Other';
  // An entry may carry a category that was since removed from settings; keep it selectable.
  const categoryOptions = categories.includes(effCategory) ? categories : [effCategory, ...categories];
  const sourceOptions = sources.includes(effSource) ? sources : [effSource, ...sources];

  const title = editing ? 'Edit entry' : 'Add entry';
  const tone = TONE_OF(kind);

  const canSave = useMemo(() => {
    if (!(Number(amount) > 0)) return false;
    if (needs === 'person' && !person.trim()) return false;
    return true;
  }, [amount, needs, person]);

  async function save() {
    setSaving(true);
    setError('');
    const body = {
      kind, amount: Number(amount), date, method, note: note.trim(),
      category: needs === 'category' ? effCategory : '',
      source: needs === 'source' ? effSource : '',
      person: needs === 'person' ? person.trim() : '',
      goal: needs === 'goal' ? (goal || null) : null,
    };
    try {
      if (editing) await api.updateTx(editing._id, body);
      else await api.createTx(body);
      notify(editing ? 'Entry updated' : `${KINDS[kind].short} saved`);
      refresh();
      closeAdd();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this entry?')) return;
    setSaving(true);
    try {
      await api.deleteTx(editing._id);
      notify('Entry deleted');
      refresh();
      closeAdd();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Sheet title={title} onClose={closeAdd}>
      {error && <div className="error">{error}</div>}

      <div className="chips" style={{ marginBottom: 14 }}>
        {ADD_ORDER.map((k) => (
          <button
            key={k}
            className={`chip ${TONE_OF(k)}`}
            aria-pressed={kind === k}
            onClick={() => setKind(k)}
          >
            {KINDS[k].short}
          </button>
        ))}
      </div>

      <div className="field">
        <label htmlFor="amt">Amount</label>
        <div className="amount-input">
          <span className="cur">{currency}</span>
          <input
            id="amt" type="number" inputMode="decimal" placeholder="0"
            value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus
            style={{ color: `var(--${tone === 'save' ? 'save' : tone === 'in' ? 'in' : 'text-primary'})` }}
          />
        </div>
      </div>

      {needs === 'category' && (
        <div className="field">
          <label htmlFor="cat">Category</label>
          <select id="cat" className="input" value={effCategory} onChange={(e) => setCategory(e.target.value)}>
            {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {needs === 'source' && (
        <div className="field">
          <label htmlFor="src">Source</label>
          <select id="src" className="input" value={effSource} onChange={(e) => setSource(e.target.value)}>
            {sourceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {needs === 'person' && (
        <div className="field">
          <label htmlFor="per">Person</label>
          <input
            id="per" className="input" list="known-people" placeholder="Name"
            value={person} onChange={(e) => setPerson(e.target.value)}
          />
          <datalist id="known-people">
            {people.map((p) => <option key={p} value={p} />)}
          </datalist>
        </div>
      )}

      {needs === 'goal' && (
        <div className="field">
          <label htmlFor="gl">Savings bucket</label>
          <select id="gl" className="input" value={goal} onChange={(e) => setGoal(e.target.value)}>
            <option value="">General savings</option>
            {goals.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
          </select>
        </div>
      )}

      <div className="row-2">
        <div className="field">
          <label htmlFor="dt">Date</label>
          <input id="dt" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="mth">Paid by</label>
          <select id="mth" className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            {methods.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="nt">Note</label>
        <input id="nt" className="input" placeholder="What was it for?" value={note}
               onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && canSave && save()} />
      </div>

      <div className="btn-row" style={{ marginTop: 16 }}>
        {editing && <button className="btn btn-danger" onClick={remove} disabled={saving}>Delete</button>}
        <button className="btn btn-in btn-block" onClick={save} disabled={!canSave || saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : `Add ${KINDS[kind].short.toLowerCase()}`}
        </button>
      </div>
    </Sheet>
  );
}
