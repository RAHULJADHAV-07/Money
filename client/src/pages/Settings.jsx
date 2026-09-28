import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApi, useStore } from '../lib/store.jsx';
import { useAuth } from '../lib/auth.jsx';
import { money, dayLabel } from '../lib/format.js';
import { KINDS } from '../lib/kinds.js';
import { CARD_DEFAULTS, ordinal } from '../lib/credit.js';
import {
  IconDownload, IconLogout, IconClose, IconPlus,
  IconWallet, IconTag, IconTarget, IconUser, IconInfo, IconSavings, IconChevronRight,
  IconSpark,
} from '../components/Icons.jsx';
import SignInMethods from '../components/SignInMethods.jsx';
import RoutineSheet from '../components/RoutineSheet.jsx';
import ExportSheet from '../components/ExportSheet.jsx';

const CADENCE_LABEL = {
  daily: 'Every day', weekly: 'Every week', monthly: 'Every month',
  yearly: 'Every year', anytime: 'Whenever',
};


/* A routine's date range, said the way you would say it out loud, and only when
   it has one -- most do not. `active` is false while today sits outside it,
   which is the whole reason the row has to mention the range at all: it is the
   answer to "why is this not on my dashboard". */
function whenLabel(r) {
  const range = r.startsOn && r.endsOn ? `${dayLabel(r.startsOn)} – ${dayLabel(r.endsOn)}`
    : r.startsOn ? `from ${dayLabel(r.startsOn)}`
    : r.endsOn ? `until ${dayLabel(r.endsOn)}`
    : '';
  if (!range) return '';
  return r.active === false ? ` · ${range} · not running now` : ` · ${range}`;
}

// Everything the settings form owns, in one place, so "has this changed?" is a
// single comparison rather than a field-by-field one.
//
// A card's opening balance is stored the way the ledger needs it -- negative,
// by what was owed -- but typed the way anyone thinks of it: "I owed 12,000".
// So the draft carries it as `owedAtStart` on the card, and `toSave` turns it
// back into a negative opening balance on the way out.
const draftOf = (s) => {
  const cards = s.creditCards || {};
  return {
    currency: s.currency,
    openingBalance: s.openingBalance,
    openingBalances: Object.fromEntries(
      Object.entries(s.openingBalances || {}).filter(([m]) => !cards[m])
    ),
    categories: [...s.categories],
    sources: [...s.sources],
    methods: [...s.methods],
    creditCards: Object.fromEntries(Object.entries(cards).map(([m, c]) => {
      const opening = Number(s.openingBalances?.[m]) || 0;
      return [m, { ...c, owedAtStart: opening < 0 ? String(-opening) : '' }];
    })),
  };
};

function toSave(draft) {
  const openingBalances = { ...draft.openingBalances };
  const creditCards = {};
  for (const [m, c] of Object.entries(draft.creditCards)) {
    if (!draft.methods.includes(m)) continue;
    const { owedAtStart, ...terms } = c;
    creditCards[m] = terms;
    openingBalances[m] = -(Number(owedAtStart) || 0);
  }
  return { ...draft, openingBalances, creditCards };
}

/* The terms a credit card runs on — the same four numbers printed at the top
   of every statement. Each one says what it is for in the words of the bill,
   because "statement day" means nothing until you know it is when the bill is
   made up. */
function CardTerms({ name, card, currency, onChange }) {
  const set = (k) => (e) => onChange({ ...card, [k]: e.target.value });
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  return (
    <div className="cc-terms">
      <NumberRow label="Credit limit" currency={currency} value={card.limit} onChange={(v) => onChange({ ...card, limit: v })} />
      <NumberRow label="Owed when you started" currency={currency} value={card.owedAtStart}
                 onChange={(v) => onChange({ ...card, owedAtStart: v })} />
      <div className="row-2 cc-days">
        <div className="field">
          <label className="field-label" htmlFor={`sd-${name}`}>Statement day</label>
          <select id={`sd-${name}`} className="input" value={card.statementDay} onChange={set('statementDay')}>
            {days.map((d) => <option key={d} value={d}>{ordinal(d)} of the month</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`dd-${name}`}>Payment due</label>
          <select id={`dd-${name}`} className="input" value={card.dueDay} onChange={set('dueDay')}>
            {days.map((d) => <option key={d} value={d}>{ordinal(d)} of the month</option>)}
          </select>
        </div>
      </div>
      <div className="row-2 cc-days">
        <div className="field">
          <label className="field-label" htmlFor={`apr-${name}`}>Interest a year</label>
          <div className="suffix-field">
            <input id={`apr-${name}`} className="input" type="number" inputMode="decimal" value={card.apr} onChange={set('apr')} />
            <span>%</span>
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`min-${name}`}>Minimum due</label>
          <div className="suffix-field">
            <input id={`min-${name}`} className="input" type="number" inputMode="decimal" value={card.minPct} onChange={set('minPct')} />
            <span>% of bill</span>
          </div>
        </div>
      </div>
      <p className="hint">
        Spending from the {ordinal(Number(card.statementDay) === 31 ? 1 : Number(card.statementDay) + 1)} to
        the {ordinal(card.statementDay)} is billed on the {ordinal(card.statementDay)}, and that bill is due
        on the {ordinal(card.dueDay)}. Pay the whole bill by then and you pay no interest. Most cards in
        India charge 36–45% a year on whatever is left.
      </p>
    </div>
  );
}

function ListEditor({ label, hint, placeholder, items, onChange }) {
  const [text, setText] = useState('');
  const add = () => {
    const v = text.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setText('');
  };

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="tags">
        {items.map((c) => (
          <span key={c} className="tag">
            {c}
            <button className="tag-x" onClick={() => onChange(items.filter((x) => x !== c))} aria-label={`Remove ${c}`}>
              <IconClose />
            </button>
          </span>
        ))}
        {!items.length && <span className="tags-empty">None yet</span>}
      </div>
      <div className="add-row">
        <input
          className="input" value={text} placeholder={placeholder || 'Add new…'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
        />
        <button className="btn btn--icon" onClick={add} disabled={!text.trim()} aria-label={`Add ${label}`}>
          <IconPlus />
        </button>
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function NumberRow({ label, value, onChange, currency }) {
  return (
    <label className="num-row">
      <span className="num-row-k">{label}</span>
      <span className="num-row-field">
        <span className="num-row-cur">{currency}</span>
        <input
          className="input input--num" type="number" inputMode="decimal" placeholder="0"
          value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        />
      </span>
    </label>
  );
}

export default function Settings() {
  const { settings, refresh, notify, startTour } = useStore();
  const { user, signOut } = useAuth();
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);   // {} for a new routine, the routine for an edit
  const [reload, setReload] = useState(0);
  const [exporting, setExporting] = useState(false);

  const routines = useApi(() => api.routines(), [reload]).data?.items || [];
  const goals = useApi(() => api.goals(), []).data?.items || [];
  const people = useApi(() => api.people(), []).data?.people?.map((p) => p.person) || [];

  useEffect(() => {
    if (settings) setDraft(draftOf(settings));
  }, [settings]);

  const dirty = useMemo(
    () => !!(settings && draft) && JSON.stringify(draftOf(settings)) !== JSON.stringify(draft),
    [settings, draft]
  );

  if (!draft) {
    return (
      <div className="page">
        <div className="skel" style={{ height: 120, marginTop: 14 }} />
        <div className="skel" style={{ height: 220, marginTop: 14 }} />
      </div>
    );
  }

  const set = (patch) => setDraft({ ...draft, ...patch });
  const openingTotal = Object.entries(draft.openingBalances || {})
    .filter(([m]) => !draft.creditCards[m])
    .reduce((n, [, v]) => n + (Number(v) || 0), 0);
  const setCard = (m, card) => {
    const creditCards = { ...draft.creditCards };
    if (card) creditCards[m] = card; else delete creditCards[m];
    set({ creditCards });
  };

  async function save() {
    setSaving(true);
    try {
      await api.saveSettings(toSave(draft));
      notify('Settings saved');
      refresh();
    } catch (err) {
      notify(err.message);
    } finally { setSaving(false); }
  }

  return (
    <div className={`page ${dirty ? 'page--savebar' : ''}`}>
      <div className="card" data-tour="opening">
        <div className="card-head">
          <h2 className="card-title"><span className="card-ico"><IconWallet /></span>Wallets</h2>
          <span className="card-sub num">{money(openingTotal, draft.currency)} opening</span>
        </div>
        <p className="hint hint--lead">
          What each wallet held before you started logging here. Everything you add moves up or down from these.
          Tick <b>credit card</b> on any wallet that is one, and it gets a bill, a due date and a limit of its own.
        </p>
        {draft.methods.map((m) => {
          const card = draft.creditCards[m];
          return (
            <div key={m} className={`wallet-set${card ? ' is-card' : ''}`}>
              {card ? (
                <div className="num-row"><span className="num-row-k">{m}</span></div>
              ) : (
                <NumberRow
                  label={m} currency={draft.currency}
                  value={draft.openingBalances[m]}
                  onChange={(v) => set({ openingBalances: { ...draft.openingBalances, [m]: v } })}
                />
              )}
              <label className="check cc-check">
                <input
                  type="checkbox" checked={!!card}
                  onChange={(e) => setCard(m, e.target.checked
                    ? { ...CARD_DEFAULTS, ...(settings.creditCards?.[m] || {}), owedAtStart: '' }
                    : null)}
                />
                <span className="check-body">
                  <b>{m} is a credit card</b>
                </span>
              </label>
              {card && (
                <CardTerms name={m} card={card} currency={draft.currency} onChange={(c) => setCard(m, c)} />
              )}
            </div>
          );
        })}
        <div className="divider" />
        <ListEditor
          label="Payment methods" placeholder="Cash, UPI, Bank…"
          items={draft.methods} onChange={(methods) => set({ methods })}
        />
        <div className="field">
          <label className="field-label" htmlFor="cur">Currency symbol</label>
          <input id="cur" className="input input--short" value={draft.currency}
                 onChange={(e) => set({ currency: e.target.value })} />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title"><span className="card-ico"><IconTag /></span>Categories &amp; sources</h2>
        </div>
        <ListEditor
          label="Expense categories" placeholder="Food, Transport…"
          items={draft.categories} onChange={(categories) => set({ categories })}
        />
        <div className="divider" />
        <ListEditor
          label="Income sources" placeholder="Salary, Freelance…"
          items={draft.sources} onChange={(sources) => set({ sources })}
        />
      </div>

      <div className="card">
        <div className="card-head">
          <h2 className="card-title"><span className="card-ico"><IconTarget /></span>Routines</h2>
          <button className="card-action" onClick={() => setEditing({})}>New<IconPlus /></button>
        </div>
        <p className="hint hint--lead">
          Entries you make over and over — a hundred into the jar, the rent every month.
          Save the shape here and it becomes one tap on the dashboard. Nothing is ever
          added without you confirming it.
        </p>

        {!routines.length && <div className="tags-empty">No routines yet</div>}
        {routines.map((r) => (
          <button key={r._id} className="rt-row" onClick={() => setEditing(r)}>
            <span className="rt-body">
              <span className="rt-name">{r.label}</span>
              <span className="rt-meta">
                {KINDS[r.kind]?.short}
                {r.goal?.name ? ` · ${r.goal.name}` : r.category ? ` · ${r.category}` : r.source ? ` · ${r.source}` : r.person ? ` · ${r.person}` : ''}
                {` · ${r.method} · ${CADENCE_LABEL[r.cadence] || r.cadence}`}
                {whenLabel(r)}
              </span>
            </span>
            <span className="rt-amt num">{money(r.amount, draft.currency)}</span>
            <IconChevronRight />
          </button>
        ))}
      </div>

      {/* Savings buckets are the Savings tab's own thing — asked for often
          enough here that the screen should say so rather than stay silent. */}
      <Link className="card card--link" to="/savings">
        <span className="card-ico"><IconSavings /></span>
        <span className="cardlink-body">
          <b>Savings buckets</b>
          <span>Create and rename them, and set what each is aiming for, on the Savings tab.</span>
        </span>
        <IconChevronRight />
      </Link>

      {/* The same tour a new account is started on. Kept reachable on purpose:
          it is the only place that explains why an entry can be refused for
          want of an opening balance, and anyone who skipped it — or who was
          already a user when it was added — would otherwise never see it. */}
      {/* Wrapped, not passed by reference: startTour takes options, and the
          click event would arrive as them. */}
      <button type="button" className="card card--link" onClick={() => startTour()}>
        <span className="card-ico"><IconSpark /></span>
        <span className="cardlink-body">
          <b>Take the guided tour</b>
          <span>A walk through all five screens, starting with your wallets. Leave it at any point.</span>
        </span>
        <IconChevronRight />
      </button>

      <div className="card">
        <div className="card-head"><h2 className="card-title"><span className="card-ico"><IconUser /></span>Account</h2></div>
        <div className="account-row">
          <span className="avatar avatar--md tone-in">{(user?.name || '?').slice(0, 1).toUpperCase()}</span>
          <span className="account-who">
            <span className="nm">{user?.name}</span>
            <span className="em">{user?.email}</span>
          </span>
          <button className="btn btn--sm btn--ghost" onClick={signOut}>
            <IconLogout />Sign out
          </button>
        </div>
      </div>

      <SignInMethods notify={notify} />

      <div className="card">
        <div className="card-head"><h2 className="card-title">Your data</h2></div>
        <button className="btn btn--block" onClick={() => setExporting(true)}>
          <IconDownload />Export a statement
        </button>
        <p className="hint">
          A PDF laid out like a bank statement, an Excel file with the columns and totals
          already set, or plain CSV — for any month, any range of dates, and any wallet.
        </p>
      </div>

      <div className="about">
        <span className="about-ico"><IconInfo /></span>
        Add My Hisab to your home screen for the full app experience — it works offline and
        syncs whatever you logged the moment you are back online.
      </div>

      {exporting && <ExportSheet onClose={() => setExporting(false)} />}

      {editing && (
        <RoutineSheet
          key={editing._id || 'new'}
          routine={editing._id ? editing : null}
          goals={goals} people={people}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setReload((n) => n + 1); }}
        />
      )}

      {dirty && (
        <div className="savebar" role="status">
          <span className="savebar-text">You have unsaved changes</span>
          <div className="btn-row">
            <button className="btn btn--sm btn--ghost" onClick={() => setDraft(draftOf(settings))} disabled={saving}>
              Discard
            </button>
            <button className="btn btn--sm btn--primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
