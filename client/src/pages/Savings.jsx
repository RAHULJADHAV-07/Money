import { useState } from 'react';
import { api } from '../lib/api.js';
import { GOAL_COLORS } from '../lib/palette.js';
import { useApi, useStore } from '../lib/store.jsx';
import { money, moneyParts } from '../lib/format.js';
import Sheet from '../components/Sheet.jsx';
import Alert from '../components/Alert.jsx';
import { Ring } from '../components/Charts.jsx';
import { IconTarget, IconPlus, IconTrash, IconCheck } from '../components/Icons.jsx';

// One source of truth: the same family the charts and wallet cards draw from.
const COLORS = GOAL_COLORS;

function GoalSheet({ goal, onClose }) {
  const { refresh, notify, currency } = useStore();
  const [name, setName] = useState(goal?.name || '');
  const [target, setTarget] = useState(goal ? String(goal.target || '') : '');
  const [color, setColor] = useState(goal?.color || COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    setBusy(true);
    await api.deleteGoal(goal._id);
    notify('Bucket deleted');
    refresh();
    onClose();
  }

  const footer = (
    <div className="btn-row">
      {goal && (
        <button className="btn btn--danger btn--icon" onClick={() => setConfirmDelete(true)} disabled={busy} aria-label="Delete bucket">
          <IconTrash />
        </button>
      )}
      <button className="btn btn--primary btn--block" onClick={save} disabled={!name.trim() || busy}>
        {goal ? 'Save changes' : 'Create bucket'}
      </button>
    </div>
  );

  return (
    <Sheet
      title={goal ? 'Edit bucket' : 'New savings bucket'}
      subtitle="A named pot inside your savings"
      onClose={onClose}
      footer={footer}
    >
      <div className="goal-preview" style={{ '--gc': color }}>
        <span className="goal-preview-dot" />
        <span className="goal-preview-name">{name.trim() || 'Untitled bucket'}</span>
        <span className="goal-preview-target num">
          {Number(target) > 0 ? money(Number(target), currency) : 'no target'}
        </span>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="gn">Name</label>
        <input id="gn" className="input" value={name} onChange={(e) => setName(e.target.value)}
               placeholder="Emergency fund, Trip, Phone…" autoFocus />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="gt">Target amount</label>
        <input id="gt" className="input" type="number" inputMode="decimal" value={target}
               onChange={(e) => setTarget(e.target.value)} placeholder="0" />
        <div className="hint">Leave blank if you just want to accumulate without a goal.</div>
      </div>

      {confirmDelete && (
        <Alert
          danger tone="danger"
          title={`Delete “${goal.name}”?`}
          message="The bucket goes away. Everything you saved into it stays in your savings total, just without a name on it."
          action="Delete" cancel="Keep it"
          onConfirm={() => { setConfirmDelete(false); remove(); }}
          onClose={() => setConfirmDelete(false)}
        />
      )}

      <div className="field">
        <span className="field-label">Colour</span>
        <div className="swatches">
          {COLORS.map((c) => (
            <button key={c} type="button" className="swatch" onClick={() => setColor(c)}
                    style={{ background: c }} aria-label={`Colour ${c}`} aria-pressed={color === c}>
              {color === c && <IconCheck />}
            </button>
          ))}
        </div>
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
  const progress = totalTarget > 0 ? Math.min(1, totalSaved / totalTarget) : 0;
  const { sign, whole, paise } = moneyParts(totalSaved, currency);

  return (
    <div className="page">
      <section className="hero hero--save hero--inset">
        <div className="hero-top">
          <span className="hero-label">Total saved</span>
          <span className="hero-chip hero-chip--static">
            {items.length} {items.length === 1 ? 'bucket' : 'buckets'}
          </span>
        </div>

        <div className="hero-split">
          <div>
            <div className="hero-amt num">
              {sign && <span className="hero-sign">{sign}</span>}
              <span className="hero-cur">{currency}</span>
              <span className="hero-whole">{whole}</span>
              {paise && <span className="hero-paise">.{paise}</span>}
            </div>
            {totalTarget > 0 && (
              <div className="hero-sub num">
                {money(Math.max(0, totalTarget - totalSaved), currency)} left to reach {money(totalTarget, currency)}
              </div>
            )}
          </div>
          {totalTarget > 0 && (
            <Ring value={progress} size={72} stroke={8} color="rgba(255,255,255,.95)"
                  label={`${Math.round(progress * 100)}%`} />
          )}
        </div>
      </section>

      <div className="btn-row" style={{ marginTop: 14 }}>
        <button className="btn btn--primary btn--block" onClick={() => openAdd({ kind: 'saving_in' })}>Add to savings</button>
        <button className="btn btn--block" onClick={() => openAdd({ kind: 'saving_out' })}>Withdraw</button>
      </div>

      <div className="section-label">
        Buckets
        <button className="section-action" onClick={() => setEditing('new')}><IconPlus />New</button>
      </div>

      {loading && !data ? (
        <div className="card">
          {[0, 1].map((i) => <div key={i} className="skel" style={{ height: 74, marginBottom: 12 }} />)}
        </div>
      ) : !items.length ? (
        <div className="empty">
          <div className="empty-ico"><IconTarget /></div>
          <div className="empty-t">No buckets yet</div>
          <div className="empty-s">Split your savings into goals like Emergency fund or Trip, so you know what each rupee is for.</div>
          <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={() => setEditing('new')}>Create a bucket</button>
        </div>
      ) : (
        <div className="goals">
          {items.map((g) => {
            const done = g.target > 0 && g.saved >= g.target;
            return (
              <article className="goal" key={g._id} style={{ '--gc': g.color }}>
                <div className="goal-head">
                  <span className="goal-name"><i className="goal-dot" />{g.name}</span>
                  <span className="goal-amt num">{money(g.saved, currency)}</span>
                </div>

                {g.target === 0 && (
                  <p className="goal-note">No target — just accumulating.</p>
                )}
                {g.target > 0 && (
                  <>
                    <div className="goal-track">
                      <i className="goal-fill" style={{ width: `${Math.max(2, g.progress * 100)}%` }} />
                    </div>
                    <div className="goal-foot">
                      <span>{Math.round(g.progress * 100)}% of {money(g.target, currency)}</span>
                      <span className={done ? 'tone-text-in' : ''}>
                        {done ? 'Goal reached' : `${money(g.target - g.saved, currency)} to go`}
                      </span>
                    </div>
                  </>
                )}

                <div className="goal-actions">
                  <button className="btn btn--sm" onClick={() => openAdd({ kind: 'saving_in', goal: g._id })}>Add</button>
                  <button className="btn btn--sm" onClick={() => openAdd({ kind: 'saving_out', goal: g._id })}>Withdraw</button>
                  <button className="btn btn--sm btn--ghost" onClick={() => setEditing(g)}>Edit</button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {unassigned !== 0 && (
        <div className="card">
          <div className="strip">
            <span className="k">General savings (no bucket)</span>
            <span className="v num">{money(unassigned, currency)}</span>
          </div>
          <p className="hint">Money you saved without picking a bucket. It still counts towards your total.</p>
        </div>
      )}

      {editing && <GoalSheet goal={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
