import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getToken } from '../lib/api.js';
import { useApi, useStore } from '../lib/store.jsx';
import { useAuth } from '../lib/auth.jsx';
import { money, dayLabel } from '../lib/format.js';
import { KINDS } from '../lib/kinds.js';
import {
  IconDownload, IconLogout, IconClose, IconPlus,
  IconWallet, IconTag, IconTarget, IconUser, IconInfo, IconSavings, IconChevronRight,
  IconSpark,
} from '../components/Icons.jsx';
import SignInMethods from '../components/SignInMethods.jsx';
import RoutineSheet from '../components/RoutineSheet.jsx';

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
const draftOf = (s) => ({
  currency: s.currency,
  openingBalance: s.openingBalance,
  openingBalances: { ...(s.openingBalances || {}) },
  categories: [...s.categories],
  sources: [...s.sources],
  methods: [...s.methods],
});

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
  const openingTotal = Object.values(draft.openingBalances || {}).reduce((n, v) => n + (Number(v) || 0), 0);

  // The export endpoint is authenticated, so fetch it with the token and hand
  // the browser a blob rather than linking straight to the URL.
  async function downloadCsv() {
    try {
      const res = await fetch(api.exportUrl(), { headers: { Authorization: `Bearer ${getToken()}` } });
      if (!res.ok) throw new Error('Could not prepare the file');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hisab-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      notify(err.message);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await api.saveSettings(draft);
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
        </p>
        {draft.methods.map((m) => (
          <NumberRow
            key={m} label={m} currency={draft.currency}
            value={draft.openingBalances[m]}
            onChange={(v) => set({ openingBalances: { ...draft.openingBalances, [m]: v } })}
          />
        ))}
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
        <button className="btn btn--block" onClick={downloadCsv}><IconDownload />Download everything as CSV</button>
        <p className="hint">Saves a spreadsheet-ready file with every entry you have logged.</p>
      </div>

      <div className="about">
        <span className="about-ico"><IconInfo /></span>
        Add My Hisab to your home screen for the full app experience — it works offline and
        syncs whatever you logged the moment you are back online.
      </div>

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
