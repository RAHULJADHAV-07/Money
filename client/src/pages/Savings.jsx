import { useState } from 'react';
import { api } from '../lib/api.js';
import { useApi, useStore } from '../lib/store.jsx';
import { money, moneyRound } from '../lib/format.js';
import Sheet from '../components/Sheet.jsx';

const COLORS = ['#2f9e6f', '#2a78d6', '#eb6834', '#4a3aa7', '#eda100', '#e87ba4'];

function GoalSheet({ goal, onClose }) {
  const { refresh, notify } = useStore();
  const [name, setName] = useState(goal?.name || '');
  const [target, setTarget] = useState(goal ? String(goal.target || '') : '');
  const [color, setColor] = useState(goal?.color || COLORS[0]);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (goal) await api.updateGoal(goal._id, { name, target: Number(target) || 0, color });
      else await api.createGoal({ name, target: Number(target) || 0, color });
      notify(goal ? 'Bucket updated' : 'Bucket created');
      refresh();
      onClose();
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm(`Delete "${goal.name}"? The money stays in your savings total.`)) return;
    setBusy(true);
    await api.deleteGoal(goal._id);
    notify('Bucket deleted');
    refresh();
    onClose();
  }

  return (
    <Sheet title={goal ? 'Edit bucket' : 'New savings bucket'} onClose={onClose}>
      <div className="field">
        <label htmlFor="gn">Name</label>
        <input id="gn" className="input" value={name} onChange={(e) => setName(e.target.value)}
               placeholder="Emergency fund, Trip, Phone…" autoFocus />
      </div>
      <div className="field">
        <label htmlFor="gt">Target amount</label>
        <input id="gt" className="input" type="number" inputMode="decimal" value={target}
               onChange={(e) => setTarget(e.target.value)} placeholder="0" />
        <div className="hint">Leave blank if you just want to accumulate without a goal.</div>
      </div>
      <div className="field">
        <label>Colour</label>
        <div style={{ display: 'flex', gap: 9 }}>
          {COLORS.map((c) => (
            <button key={c} onClick={() => setColor(c)} aria-label={`Colour ${c}`}
              style={{
                width: 32, height: 32, borderRadius: 10, background: c,
                outline: color === c ? '2px solid var(--text-primary)' : 'none', outlineOffset: 2,
              }} />
          ))}
        </div>
      </div>
      <div className="btn-row" style={{ marginTop: 16 }}>
        {goal && <button className="btn btn-danger" onClick={remove} disabled={busy}>Delete</button>}
        <button className="btn btn-in btn-block" onClick={save} disabled={!name.trim() || busy}>
          {goal ? 'Save changes' : 'Create bucket'}
        </button>
      </div>
    </Sheet>
  );
}

export default function Savings() {
  const { currency, openAdd } = useStore();
  const [editing, setEditing] = useState(null);   // goal object | 'new' | null
  const { data, loading } = useApi(() => api.goals(), []);

  const items = data?.items || [];
  const totalSaved = data?.totalSaved || 0;
  const totalTarget = data?.totalTarget || 0;
  const unassigned = data?.unassigned || 0;

  return (
    <div className="page">
      <div className="hero" style={{ margin: '16px 0 0', background: 'linear-gradient(150deg, #2a78d6 0%, #1f5fae 55%, #184f95 100%)' }}>
        <div className="label">Total saved</div>
        <div className="amount tabular">{moneyRound(totalSaved, currency)}</div>
        {totalTarget > 0 && (
          <div className="foot">
            <div>
              <div className="k">Across all targets</div>
              <div className="v tabular">{moneyRound(totalTarget, currency)}</div>
            </div>
            <div>
              <div className="k">Progress</div>
              <div className="v tabular">{Math.round(Math.min(1, totalSaved / totalTarget) * 100)}%</div>
            </div>
          </div>
        )}
      </div>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button className="btn btn-in btn-block" onClick={() => openAdd({ kind: 'saving_in' })}>Add to savings</button>
        <button className="btn btn-block" onClick={() => openAdd({ kind: 'saving_out' })}>Withdraw</button>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Buckets</h2>
          <button className="more" onClick={() => setEditing('new')}>+ New</button>
        </div>

        {loading && !data ? (
          [0, 1].map((i) => <div key={i} className="skeleton" style={{ height: 62, marginBottom: 10 }} />)
        ) : !items.length ? (
          <div className="empty" style={{ padding: '28px 10px' }}>
            <div className="t">No buckets yet</div>
            <div className="s">Split your savings into goals like Emergency fund or Trip, so you know what each rupee is for.</div>
            <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => setEditing('new')}>Create a bucket</button>
          </div>
        ) : (
          items.map((g) => (
            <div className="goal" key={g._id}>
              <div className="goal-top">
                <span className="goal-name">
                  <i className="dot" style={{ background: g.color }} />{g.name}
                </span>
                <span className="goal-amt tabular">{money(g.saved, currency)}</span>
              </div>
              {g.target > 0 && (
                <>
                  <div className="goal-track">
                    <div className="goal-fill" style={{ width: `${Math.max(1.5, g.progress * 100)}%`, background: g.color }} />
                  </div>
                  <div className="goal-foot">
                    <span>{Math.round(g.progress * 100)}% of {money(g.target, currency)}</span>
                    <span>{g.saved >= g.target ? 'Goal reached' : `${money(g.target - g.saved, currency)} to go`}</span>
                  </div>
                </>
              )}
              <div className="goal-actions">
                <button className="btn btn-sm" onClick={() => openAdd({ kind: 'saving_in', goal: g._id })}>Add</button>
                <button className="btn btn-sm" onClick={() => openAdd({ kind: 'saving_out', goal: g._id })}>Withdraw</button>
                <button className="btn btn-sm" onClick={() => setEditing(g)}>Edit</button>
              </div>
            </div>
          ))
        )}

        {unassigned !== 0 && (
          <>
            <div className="divider" />
            <div className="strip">
              <span className="k">General savings (no bucket)</span>
              <span className="v tabular">{money(unassigned, currency)}</span>
            </div>
          </>
        )}
      </div>

      {editing && <GoalSheet goal={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
