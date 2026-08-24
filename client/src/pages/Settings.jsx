import { useEffect, useState } from 'react';
import { api, getToken } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { useAuth } from '../lib/auth.jsx';
import { money } from '../lib/format.js';

function ListEditor({ label, hint, items, onChange }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onChange([...items, v]);
    setDraft('');
  };
  return (
    <div className="field">
      <label>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 9 }}>
        {items.map((c) => (
          <span key={c} className="chip" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {c}
            <button onClick={() => onChange(items.filter((x) => x !== c))} aria-label={`Remove ${c}`}
                    style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="input" value={draft} placeholder="Add new…" onChange={(e) => setDraft(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())} />
        <button className="btn" onClick={add} disabled={!draft.trim()}>Add</button>
      </div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export default function Settings() {
  const { settings, refresh, notify } = useStore();
  const { user, signOut } = useAuth();
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('hisab.theme') || 'system');

  useEffect(() => {
    if (settings) {
      setDraft({
        currency: settings.currency,
        openingBalance: settings.openingBalance,
        categories: settings.categories,
        sources: settings.sources,
        methods: settings.methods,
        budgets: settings.budgets || {},
      });
    }
  }, [settings]);

  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hisab.theme', theme);
  }, [theme]);

  if (!draft) return <div className="page"><div className="skeleton" style={{ height: 200, marginTop: 16 }} /></div>;

  const set = (patch) => setDraft({ ...draft, ...patch });

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
    <div className="page">
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h2>Appearance</h2></div>
        <div className="chips">
          {['system', 'light', 'dark'].map((t) => (
            <button key={t} className="chip" aria-pressed={theme === t} onClick={() => setTheme(t)}
                    style={{ textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Money</h2></div>
        <div className="row-2">
          <div className="field">
            <label htmlFor="cur">Currency symbol</label>
            <input id="cur" className="input" value={draft.currency} onChange={(e) => set({ currency: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="ob">Opening balance</label>
            <input id="ob" className="input" type="number" inputMode="decimal" value={draft.openingBalance}
                   onChange={(e) => set({ openingBalance: e.target.value })} />
          </div>
        </div>
        <div className="hint">
          Opening balance is the cash you already had before you started logging here. Everything you add moves up or down from it.
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Categories & sources</h2></div>
        <ListEditor label="Expense categories" items={draft.categories} onChange={(categories) => set({ categories })} />
        <div className="divider" />
        <ListEditor label="Income sources" items={draft.sources} onChange={(sources) => set({ sources })} />
        <div className="divider" />
        <ListEditor label="Payment methods" items={draft.methods} onChange={(methods) => set({ methods })} />
      </div>

      <div className="card">
        <div className="card-head"><h2>Monthly budgets</h2></div>
        <div className="hint" style={{ marginTop: -6, marginBottom: 12 }}>
          Optional. A category that goes over its budget turns orange on the dashboard.
        </div>
        {draft.categories.map((c) => (
          <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ flex: 1, fontSize: 13.5 }}>{c}</span>
            <input
              className="input" type="number" inputMode="decimal" placeholder="0"
              style={{ width: 120, textAlign: 'right' }}
              value={draft.budgets[c] ?? ''}
              onChange={(e) => set({ budgets: { ...draft.budgets, [c]: e.target.value } })}
            />
          </div>
        ))}
      </div>

      <button className="btn btn-in btn-block" style={{ marginTop: 14 }} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save settings'}
      </button>

      <div className="card">
        <div className="card-head"><h2>Account</h2></div>
        <div className="account-row">
          <span className="avatar in">{(user?.name || '?').slice(0, 1).toUpperCase()}</span>
          <span className="who">
            <span className="nm">{user?.name}</span>
            <span className="em">{user?.email}</span>
          </span>
          <button className="btn btn-sm" onClick={signOut}>Sign out</button>
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h2>Your data</h2></div>
        <button className="btn btn-block" onClick={downloadCsv}>Download everything as CSV</button>
        <div className="hint">Saves a spreadsheet-ready file with every entry you have logged.</div>
      </div>

      <div className="empty" style={{ padding: '22px 10px' }}>
        <div className="s">My Hisab · v{__APP_VERSION__}<br />Add to home screen for the full app experience.</div>
      </div>
    </div>
  );
}
