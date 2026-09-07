import { useEffect, useMemo, useRef, useState } from 'react';
import Sheet from './Sheet.jsx';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { KINDS, ADD_ORDER, isSettle, dirOf } from '../lib/kinds.js';
import { todayKey, money } from '../lib/format.js';
import { IconTrash, IconSplit, IconChevronRight } from './Icons.jsx';
import Alert from './Alert.jsx';

const TONE_OF = (kind) => KINDS[kind]?.tone || 'out';

export default function AddSheet() {
  const { addSheet, closeAdd, openSplit, settings, refresh, notify, currency } = useStore();
  const editing = addSheet?.tx || null;

  const [kind, setKind] = useState(addSheet?.kind || 'expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('');
  const [person, setPerson] = useState(addSheet?.person || '');
  const [goal, setGoal] = useState(addSheet?.goal || '');
  const [toMethod, setToMethod] = useState('');
  const [date, setDate] = useState(todayKey);
  const [method, setMethod] = useState('Cash');
  const [note, setNote] = useState('');
  const [goals, setGoals] = useState([]);
  const [people, setPeople] = useState([]);
  const [wallets, setWallets] = useState(null);
  const [alert, setAlert] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const chipsRef = useRef(null);

  useEffect(() => {
    api.goals().then((g) => setGoals(g.items)).catch(() => {});
    api.people().then((p) => setPeople(p.people.map((x) => x.person))).catch(() => {});
  }, []);

  /* Wallet balances, with the entry being edited left out — otherwise raising a
     100 to 150 would be measured against a balance that still had the 100
     deducted, and a perfectly ordinary edit would look unaffordable. */
  useEffect(() => {
    let alive = true;
    api.wallets(editing?._id)
      .then((r) => alive && setWallets(r.wallets))
      .catch(() => alive && setWallets(null));
    return () => { alive = false; };
  }, [editing?._id]);

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
      setToMethod(editing.toMethod || '');
      setNote(editing.note || '');
    } else {
      if (addSheet?.kind) setKind(addSheet.kind);
      if (addSheet?.person) setPerson(addSheet.person);
      if (addSheet?.goal) setGoal(addSheet.goal);
      if (addSheet?.amount) setAmount(String(addSheet.amount));
      if (addSheet?.note) setNote(addSheet.note);
    }
  }, [editing, addSheet]);

  /* The chip row scrolls, and the sheet can open on a kind that sits well past
     the fold — "Waived", say, opened from a person. Bring it into view, but only
     when it is actually out of view, so tapping a visible chip never jumps. */
  useEffect(() => {
    const box = chipsRef.current;
    const chip = box?.querySelector('[aria-pressed="true"]');
    if (!box || !chip) return;
    const left = chip.offsetLeft;
    const right = left + chip.offsetWidth;
    if (left < box.scrollLeft || right > box.scrollLeft + box.clientWidth) {
      box.scrollTo({ left: left - (box.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' });
    }
  }, [kind]);

  const needs = KINDS[kind]?.needs;
  const categories = settings?.categories || [];
  const sources = settings?.sources || [];
  const methods = settings?.methods?.length ? settings.methods : ['Cash', 'UPI', 'Bank', 'Card'];

  // Resolved at render time, not in an effect — an effect racing the "seed from
  // the entry being edited" effect above would overwrite the entry's own value.
  const effCategory = category || categories[0] || 'Misc';
  const effSource = source || sources[0] || 'Other';
  // An entry may carry a category or wallet that was since removed from settings;
  // keep it selectable, and keep the resolved value pointing at it.
  const categoryOptions = categories.includes(effCategory) ? categories : [effCategory, ...categories];
  const sourceOptions = sources.includes(effSource) ? sources : [effSource, ...sources];
  const methodOptions = methods.includes(method) || !method ? methods : [method, ...methods];
  const effMethod = methodOptions.includes(method) ? method : (methodOptions[0] || 'Cash');

  const title = editing ? 'Edit entry' : 'Add entry';
  const tone = TONE_OF(kind);
  const needsWallet = needs !== 'transfer' && !isSettle(kind);

  // A transfer needs somewhere to go, and it cannot go where it already is.
  const otherMethods = methodOptions.filter((m) => m !== effMethod);
  const effToMethod = needs === 'transfer' ? (toMethod && toMethod !== effMethod ? toMethod : otherMethods[0] || '') : '';

  const canSave = useMemo(() => {
    if (!(Number(amount) > 0)) return false;
    if (needs === 'person' && !person.trim()) return false;
    if (needs === 'transfer' && !effToMethod) return false;
    return true;
  }, [amount, needs, person, effToMethod]);

  /* What the wallet paying for this entry holds, and whether the entry would
     take more than that. Income and settlements take nothing out, so they can
     never be short; a transfer does leave its wallet even though its direction
     is neutral overall. While the balances are still loading `available` is
     null, and nothing is blocked on a guess. */
  const available = wallets ? (wallets.find((w) => w.name === effMethod)?.balance ?? 0) : null;
  const spend = (needs === 'transfer' || dirOf(kind) < 0) ? Number(amount) || 0 : 0;
  const takesFromWallet = spend > 0 && available !== null;
  const short = takesFromWallet && spend > available + 0.005;

  // An empty wallet usually means the opening balance was never set, rather
  // than that there is genuinely nothing there — so the way out is named.
  const shortMessage = () =>
    `${available <= 0.005 ? `${effMethod} is empty.` : `${effMethod} only has ${money(available, currency)}.`} ` +
    `This entry needs ${money(spend, currency)}. Pick another wallet, or if ${effMethod} already held money ` +
    `before you started logging here, set its opening balance in Settings → Wallets.`;

  async function save() {
    if (short) {
      setAlert({ title: `Not enough in ${effMethod}`, message: shortMessage() });
      return;
    }
    setSaving(true);
    setError('');
    const body = {
      kind, amount: Number(amount), date, method: effMethod, note: note.trim(),
      category: needs === 'category' ? effCategory : '',
      source: needs === 'source' ? effSource : '',
      person: needs === 'person' ? person.trim() : '',
      goal: needs === 'goal' ? (goal || null) : null,
      toMethod: needs === 'transfer' ? effToMethod : '',
    };
    try {
      if (editing) await api.updateTx(editing._id, body);
      else await api.createTx(body);
      notify(editing ? 'Entry updated' : `${KINDS[kind].short} saved`);
      refresh();
      closeAdd();
    } catch (err) {
      // The server checks the same rule; if it refuses (stale balances, or a
      // queued entry replayed later) say so the same way rather than inline.
      if (err.code === 'INSUFFICIENT_FUNDS') setAlert({ title: 'Not enough in that wallet', message: err.message });
      else setError(err.message);
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
    <Sheet title={title} subtitle={KINDS[kind]?.label} onClose={closeAdd}>
      {error && <div className="error-msg" role="alert">{error}</div>}

      <div className="chips" ref={chipsRef}>
        {ADD_ORDER.map((k) => (
          <button key={k} className={`chip chip--${TONE_OF(k)}`} aria-pressed={kind === k} onClick={() => setKind(k)}>
            {KINDS[k].short}
          </button>
        ))}
      </div>

      {/* One payment can mean several things at once — half yours, half theirs,
          or a repayment that came back with extra. That does not fit one kind,
          so it gets its own sheet rather than a mode of this one. */}
      {!editing && (
        <button type="button" className="splitcue" onClick={() => openSplit({})}>
          <span className="splitcue-ico"><IconSplit /></span>
          <span className="splitcue-body">
            <b>Was it more than one thing?</b>
            <span>A bill you shared, or money that was partly one thing and partly another.</span>
          </span>
          <IconChevronRight />
        </button>
      )}

      <div className="field field--lead">
        <label className="field-label" htmlFor="amt">Amount</label>
        <div className="amount-field">
          <span className="amount-cur">{currency}</span>
          <input
            id="amt" type="number" inputMode="decimal" placeholder="0"
            value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus
            className={`amount-input tone-text-${tone === 'flat' ? 'ink' : tone}`}
          />
        </div>
        {short && (
          <p className="field-warn" role="status">
            {available <= 0.005
              ? `${effMethod} is empty — this needs ${money(spend, currency)}.`
              : `${effMethod} has ${money(available, currency)} — ${money(spend - available, currency)} short.`}
          </p>
        )}
      </div>

      {needs === 'category' && (
        <div className="field">
          <label className="field-label" htmlFor="cat">Category</label>
          <select id="cat" className="input" value={effCategory} onChange={(e) => setCategory(e.target.value)}>
            {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {needs === 'source' && (
        <div className="field">
          <label className="field-label" htmlFor="src">Source</label>
          <select id="src" className="input" value={effSource} onChange={(e) => setSource(e.target.value)}>
            {sourceOptions.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}

      {needs === 'person' && (
        <div className="field">
          <label className="field-label" htmlFor="per">Person</label>
          <input
            id="per" className="input" list="known-people" placeholder="Name" autoComplete="off"
            value={person} onChange={(e) => setPerson(e.target.value)}
          />
          <datalist id="known-people">
            {people.map((p) => <option key={p} value={p} />)}
          </datalist>
        </div>
      )}

      {needs === 'goal' && (
        <div className="field">
          <label className="field-label" htmlFor="gl">Savings bucket</label>
          <select id="gl" className="input" value={goal} onChange={(e) => setGoal(e.target.value)}>
            <option value="">General savings</option>
            {goals.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
          </select>
        </div>
      )}

      {needs === 'transfer' && (
        <div className="row-2">
          <div className="field">
            <label className="field-label" htmlFor="from-mth">
              From{available !== null && <span className="field-note">{money(available, currency)} in {effMethod}</span>}
            </label>
            <select id="from-mth" className="input" value={effMethod} onChange={(e) => setMethod(e.target.value)}>
              {methodOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="to-mth">To</label>
            <select id="to-mth" className="input" value={effToMethod} onChange={(e) => setToMethod(e.target.value)}>
              {otherMethods.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      )}

      {isSettle(kind) && (
        <div className="note-box">
          <span>Clears what is owed without any money moving. Your balance stays exactly the same.</span>
        </div>
      )}

      {/* Transfers name their own two wallets above, and a settlement moves no
          money at all — in both cases the date is on its own and takes the row. */}
      <div className={needsWallet ? 'row-2' : ''}>
        <div className="field">
          <label className="field-label" htmlFor="dt">Date</label>
          <input id="dt" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {needsWallet && (
          <div className="field">
            <label className="field-label" htmlFor="pay-mth">
              {KINDS[kind].dir > 0 ? 'Received in' : 'Paid from'}
              {available !== null && dirOf(kind) < 0 && (
                <span className="field-note">{money(available, currency)} available</span>
              )}
            </label>
            <select id="pay-mth" className="input" value={effMethod} onChange={(e) => setMethod(e.target.value)}>
              {methodOptions.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="nt">Note</label>
        <input id="nt" className="input" placeholder="What was it for?" value={note}
               onChange={(e) => setNote(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && canSave && save()} />
      </div>

      <div className="btn-row btn-row--form">
        {editing && (
          <button className="btn btn--danger btn--icon" onClick={remove} disabled={saving} aria-label="Delete entry">
            <IconTrash />
          </button>
        )}
        <button className="btn btn--primary btn--block" onClick={save} disabled={!canSave || saving}>
          {saving ? 'Saving…' : editing ? 'Save changes' : KINDS[kind].cta}
        </button>
      </div>

      {alert && (
        <Alert title={alert.title} message={alert.message} onClose={() => setAlert(null)} />
      )}
    </Sheet>
  );
}
