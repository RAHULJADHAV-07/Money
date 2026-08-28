import { useEffect, useMemo, useState } from 'react';
import { api, getToken } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useAuth } from '../lib/auth.jsx';
import { useTheme, THEMES } from '../lib/theme.js';
import { money } from '../lib/format.js';
import {
  IconSun, IconMoon, IconAuto, IconDownload, IconLogout, IconClose, IconPlus,
  IconWallet, IconTag, IconTarget, IconUser, IconInfo,
} from '../components/Icons.jsx';

const THEME_ICON = { system: <IconAuto />, light: <IconSun />, dark: <IconMoon /> };

// Everything the settings form owns, in one place, so "has this changed?" is a
// single comparison rather than a field-by-field one.
const draftOf = (s) => ({
  currency: s.currency,
  openingBalance: s.openingBalance,
  openingBalances: { ...(s.openingBalances || {}) },
  categories: [...s.categories],
  sources: [...s.sources],
  methods: [...s.methods],
  budgets: { ...(s.budgets || {}) },
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
  const { settings, refresh, notify } = useStore();
  const { user, signOut } = useAuth();
  const [theme, setTheme] = useTheme();
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

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
  const budgetTotal = Object.values(draft.budgets || {}).reduce((n, v) => n + (Number(v) || 0), 0);

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
      <div className="card">
        <div className="card-head"><h2 className="card-title">Appearance</h2></div>
        <div className="theme-picker">
          {THEMES.map((t) => (
            <button key={t} className="theme-opt" aria-pressed={theme === t} onClick={() => setTheme(t)}>
              <span className={`theme-swatch theme-swatch--${t}`} aria-hidden="true" />
              <span className="theme-opt-ico">{THEME_ICON[t]}</span>
              <span className="theme-opt-label">{t}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card">
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
          <h2 className="card-title"><span className="card-ico"><IconTarget /></span>Monthly budgets</h2>
          {budgetTotal > 0 && <span className="card-sub num">{money(budgetTotal, draft.currency)} total</span>}
        </div>
        <p className="hint hint--lead">
          Optional. A category that goes over its budget is flagged on the dashboard.
        </p>
        {draft.categories.map((c) => (
          <NumberRow
            key={c} label={c} currency={draft.currency}
            value={draft.budgets[c]}
            onChange={(v) => set({ budgets: { ...draft.budgets, [c]: v } })}
          />
        ))}
      </div>

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
