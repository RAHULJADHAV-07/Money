import { useMemo, useState } from 'react';
import Sheet from './Sheet.jsx';
import Alert from './Alert.jsx';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { money as fmt, dateShort, todayKey } from '../lib/format.js';
import { GOAL_COLORS } from '../lib/palette.js';
import { NEW_CARD, ordinal, currentCycle, moneyWallets, isCard } from '../lib/credit.js';
import { IconChevronDown, IconTrash } from './Icons.jsx';

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/* The first `dueDay` after a statement date — the same rule the server uses,
   only here to preview the dates while the form is being filled in. */
function dueAfter(stmt, dueDay) {
  const [y, m] = stmt.split('-').map(Number);
  const at = (mm) => {
    const last = new Date(Date.UTC(y, mm + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, mm, Math.min(dueDay, last))).toISOString().slice(0, 10);
  };
  const same = at(m - 1);
  return same > stmt ? same : at(m);
}

/* The saved card, as the form edits it: every optional number as a string,
   empty meaning "not set" — never zero standing in for it. */
function formOf(name, terms, opening) {
  const s = (v) => (v === null || v === undefined ? '' : String(v));
  return {
    name,
    limit: s(terms.limit || ''),
    statementDay: s(terms.statementDay),
    dueDay: s(terms.dueDay),
    renewal: terms.renewal ? { ...terms.renewal } : { kind: 'annual', month: '' },
    openingOutstanding: opening < 0 ? String(-opening) : '',
    minPct: s(terms.minPct), apr: s(terms.apr),
    color: terms.color || '', notes: terms.notes || '',
  };
}

/*
 * Adding or editing a credit card.
 *
 * Three things are asked for and nothing else is required: the limit, the day
 * the statement is made up, and when the card renews or expires. The limit is
 * the card's spending capacity — it is kept on the card and never becomes
 * money anywhere in the app.
 */
export default function CardSetupSheet({ name: editing = null, onClose }) {
  const { settings, refresh, notify, currency } = useStore();
  const money = (n) => fmt(n, currency);
  const saved = editing ? settings?.creditCards?.[editing] : null;
  const [form, setForm] = useState(() =>
    saved ? formOf(editing, saved, Number(settings?.openingBalances?.[editing]) || 0) : { ...NEW_CARD, renewal: { ...NEW_CARD.renewal } });
  const [more, setMore] = useState(() => !!saved && !!(saved.minPct !== null || saved.apr !== null || saved.notes
    || Number(settings?.openingBalances?.[editing]) < 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const name = form.name.trim();
  const wallets = moneyWallets(settings);
  const converting = !editing && wallets.includes(name);
  const taken = !!name && name !== editing && (isCard(settings, name) || (editing && (settings?.methods || []).includes(name)));

  // The three required answers, said in the words of the form.
  const missing = !name ? 'Give the card a name'
    : taken ? `There is already a wallet called ${name}`
    : !(Number(form.limit) > 0) ? 'Enter the credit limit'
    : !form.statementDay ? 'Choose the statement date'
    : !/^\d{4}-\d{2}$/.test(form.renewal.month) ? 'Choose when the card renews or expires'
    : '';

  /* The dates this card will run on, worked out from what has been typed, so
     "statement date" and "due date" mean something before the card exists. */
  const preview = useMemo(() => {
    const day = Number(form.statementDay);
    if (!day) return null;
    const c = currentCycle(todayKey(), day);
    return { ...c, due: form.dueDay ? dueAfter(c.end, Number(form.dueDay)) : null };
  }, [form.statementDay, form.dueDay]);

  const outstanding = Number(form.openingOutstanding) || 0;
  const limit = Number(form.limit) || 0;

  async function save() {
    if (missing) { setError(missing); return; }
    setSaving(true);
    setError('');
    const body = {
      name,
      limit: form.limit, statementDay: form.statementDay, dueDay: form.dueDay,
      renewal: form.renewal,
      openingOutstanding: form.openingOutstanding || 0,
      minPct: form.minPct, apr: form.apr, color: form.color, notes: form.notes,
    };
    try {
      if (editing) await api.updateCard(editing, body);
      else await api.createCard(body);
      notify(editing ? `${name} updated` : `${name} added`);
      refresh();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    try {
      await api.removeCard(editing);
      notify(`${editing} is an ordinary wallet now`);
      refresh();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Sheet
      title={editing ? `Edit ${editing}` : 'Add a credit card'}
      subtitle="Credit card"
      onClose={onClose}
      footer={(
        <div className="btn-row">
          {editing && (
            <button className="btn btn--danger btn--icon" onClick={() => setConfirmRemove(true)} disabled={saving} aria-label="Stop treating as a credit card">
              <IconTrash />
            </button>
          )}
          <button className="btn btn--primary btn--block" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save card' : 'Add card'}
          </button>
        </div>
      )}
    >
      {error && <div className="error-msg" role="alert">{error}</div>}

      <h3 className="form-h">Card details</h3>
      <div className="field">
        <label className="field-label" htmlFor="cc-name">Card name <span className="req">Required</span></label>
        <input id="cc-name" className="input" list="cc-wallets" placeholder="HDFC Millennia, Amazon Pay…" autoComplete="off"
               value={form.name} onChange={(e) => set({ name: e.target.value })} />
        <datalist id="cc-wallets">{!editing && wallets.map((w) => <option key={w} value={w} />)}</datalist>
        {converting && (
          <p className="hint">{name} is already one of your wallets — it becomes this card, and its entries come with it.</p>
        )}
        {editing && name && name !== editing && !taken && (
          <p className="hint">Every entry on {editing} moves to the new name.</p>
        )}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="cc-limit">Credit limit <span className="req">Required</span></label>
        <div className="amount-field amount-field--sm">
          <span className="amount-cur">{currency}</span>
          <input id="cc-limit" className="amount-input" type="number" inputMode="decimal" placeholder="0"
                 value={form.limit} onChange={(e) => set({ limit: e.target.value })} />
        </div>
        <p className="hint">How much the bank lets you spend. It is not money you have — it never adds to your balance.</p>
      </div>

      <div className="field">
        <span className="field-label">Colour</span>
        <div className="swatches">
          <button type="button" className="swatch swatch--auto" aria-pressed={!form.color} onClick={() => set({ color: '' })} aria-label="Automatic colour">A</button>
          {GOAL_COLORS.map((c) => (
            <button key={c} type="button" className="swatch" aria-pressed={form.color === c} style={{ background: c }}
                    onClick={() => set({ color: c })} aria-label="Card colour" />
          ))}
        </div>
      </div>

      <h3 className="form-h">Billing</h3>
      <div className="row-2">
        <div className="field">
          <label className="field-label" htmlFor="cc-sd">Statement date <span className="req">Required</span></label>
          <select id="cc-sd" className="input" value={form.statementDay} onChange={(e) => set({ statementDay: e.target.value })}>
            <option value="">Choose…</option>
            {DAYS.map((d) => <option key={d} value={d}>{ordinal(d)} of the month</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="cc-dd">Payment due <span className="opt">Optional</span></label>
          <select id="cc-dd" className="input" value={form.dueDay} onChange={(e) => set({ dueDay: e.target.value })}>
            <option value="">Not set</option>
            {DAYS.map((d) => <option key={d} value={d}>{ordinal(d)} of the month</option>)}
          </select>
        </div>
      </div>
      {preview ? (
        <div className="cc-preview">
          <div><span>Current billing cycle</span><b>{dateShort(preview.start)} → {dateShort(preview.end)}</b></div>
          <div><span>Statement closes</span><b>{dateShort(preview.end)}</b></div>
          <div><span>Payment due</span><b>{preview.due ? dateShort(preview.due) : 'Not set'}</b></div>
        </div>
      ) : (
        <p className="hint hint--lead">
          The <b>statement date</b> is when a billing cycle closes and the bill is made up. The <b>payment due</b> date
          is when that bill must be paid — usually 15–20 days later.
        </p>
      )}

      <h3 className="form-h">Card lifecycle</h3>
      <div className="seg" role="tablist" aria-label="Renewal">
        {[['annual', 'Renews every year'], ['expiry', 'Expires']].map(([k, label]) => (
          <button key={k} type="button" role="tab" className="seg-btn" aria-selected={form.renewal.kind === k}
                  onClick={() => set({ renewal: { ...form.renewal, kind: k } })}>{label}</button>
        ))}
      </div>
      <div className="field">
        <label className="field-label" htmlFor="cc-ren">
          {form.renewal.kind === 'expiry' ? 'Expiry month' : 'Renewal month'} <span className="req">Required</span>
        </label>
        <input id="cc-ren" className="input" type="month" value={form.renewal.month}
               onChange={(e) => set({ renewal: { ...form.renewal, month: e.target.value } })} />
        <p className="hint">
          {form.renewal.kind === 'expiry'
            ? 'After this month the card is marked expired. Its statements and entries all stay.'
            : 'A reminder for the annual fee or renewal. It never resets your statements, spending or what you owe.'}
        </p>
      </div>

      <button type="button" className="kindmore" aria-expanded={more} onClick={() => setMore((v) => !v)}>
        <IconChevronDown />{more ? 'Fewer options' : 'More options — opening outstanding, minimum due, interest, notes'}
      </button>

      {more && (
        <div className="cc-adv">
          <div className="field">
            <label className="field-label" htmlFor="cc-open">
              Opening outstanding <span className="opt">Optional</span>
            </label>
            <div className="amount-field amount-field--sm">
              <span className="amount-cur">{currency}</span>
              <input id="cc-open" className="amount-input" type="number" inputMode="decimal" placeholder="0"
                     value={form.openingOutstanding} onChange={(e) => set({ openingOutstanding: e.target.value })} />
            </div>
            <p className="hint">
              Only if you already owed something on this card before logging it here. Leave it empty for a new card.
              {limit > 0 && ` Available credit starts at ${money(Math.max(0, limit - outstanding))}.`}
            </p>
            {limit > 0 && outstanding >= limit && (
              <p className="field-warn">That is the whole limit. If you meant the limit, put it above and leave this empty.</p>
            )}
          </div>
          <div className="row-2">
            <div className="field">
              <label className="field-label" htmlFor="cc-min">Minimum due</label>
              <div className="suffix-field">
                <input id="cc-min" className="input" type="number" inputMode="decimal" placeholder="e.g. 5"
                       value={form.minPct} onChange={(e) => set({ minPct: e.target.value })} />
                <span>% of bill</span>
              </div>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="cc-apr">Interest</label>
              <div className="suffix-field">
                <input id="cc-apr" className="input" type="number" inputMode="decimal" placeholder="e.g. 42"
                       value={form.apr} onChange={(e) => set({ apr: e.target.value })} />
                <span>% a year</span>
              </div>
            </div>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="cc-notes">Notes</label>
            <input id="cc-notes" className="input" placeholder="Annual fee waived over ₹1L spend…"
                   value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </div>
        </div>
      )}

      {confirmRemove && (
        <Alert
          danger tone="danger"
          title={`Stop treating ${editing} as a credit card?`}
          message={`${editing} stays as an ordinary wallet with every entry on it. Only its limit, dates and statements go.`}
          action="Stop" cancel="Keep it"
          onConfirm={() => { setConfirmRemove(false); remove(); }}
          onClose={() => setConfirmRemove(false)}
        />
      )}
    </Sheet>
  );
}
