import { useEffect, useMemo, useRef, useState } from 'react';
import Sheet from './Sheet.jsx';
import Alert from './Alert.jsx';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { ME, REASONS, reasonOf, derive, describe, problems } from '../lib/derive.js';
import { todayKey, money as fmt } from '../lib/format.js';
import { IconTrash, IconPlus, IconSplit, IconChevronRight } from './Icons.jsx';

/*
 * One thing that happened, entered the way you would say it out loud.
 *
 * You answer plain questions -- what the bill was, who paid, what each share is
 * -- and the ledger entries are worked out from the answers. What they come to
 * is read back as sentences before you save, so nothing is recorded that you
 * have not already seen in your own words.
 *
 * The answers are saved alongside the entries, so reopening a split puts your
 * own words back in front of you rather than the rows they became.
 */

const paise = (n) => Math.round((Number(n) || 0) * 100) / 100;
let seq = 0;
const key = () => `r${++seq}`;

const blankBill = (method) => ({
  shape: 'bill',
  total: '', category: '', payer: ME, carried: false, method,
  people: [{ key: key(), name: ME, share: '' }, { key: key(), name: '', share: '' }],
});

const blankFlow = (direction, method) => ({
  shape: 'flow',
  direction, amount: '', person: '', method,
  rows: [
    { key: key(), amount: '', reason: REASONS[direction][0].id, category: '', source: '', goal: '' },
    { key: key(), amount: '', reason: REASONS[direction][1].id, category: '', source: '', goal: '' },
  ],
});

const SHAPES = [
  { id: 'bill', title: 'We shared a bill', hint: 'One cost, split between people', icon: <IconSplit /> },
  { id: 'in',   title: 'Money came to me', hint: 'Part of it was one thing, part another', icon: <span className="shape-sign">+</span> },
  { id: 'out',  title: 'Money I paid out', hint: 'Part of it was one thing, part another', icon: <span className="shape-sign">&minus;</span> },
];

export default function SplitSheet() {
  const { splitSheet, closeSplit, settings, refresh, notify, currency } = useStore();
  const groupId = splitSheet?.groupId || null;

  const methods = settings?.methods?.length ? settings.methods : ['Cash', 'UPI', 'Bank', 'Card'];
  const categories = settings?.categories || [];
  const sources = settings?.sources || [];

  const [form, setForm] = useState(null);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayKey);
  const [goals, setGoals] = useState([]);
  const [people, setPeople] = useState([]);
  const [wallets, setWallets] = useState(null);
  const [loading, setLoading] = useState(!!groupId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState(null);
  const tailRef = useRef(null);

  const money = (n) => fmt(n, currency);

  useEffect(() => {
    api.goals().then((g) => setGoals(g.items)).catch(() => {});
    api.people().then((p) => setPeople(p.people.map((x) => x.person))).catch(() => {});
  }, []);

  /* Balances with this split's own parts left out, so re-saving an edit is not
     measured against money the split itself is already holding. */
  useEffect(() => {
    let alive = true;
    api.wallets(null, groupId)
      .then((r) => alive && setWallets(r.wallets))
      .catch(() => alive && setWallets(null));
    return () => { alive = false; };
  }, [groupId]);

  // Reopening a split restores the answers, not the rows they turned into.
  useEffect(() => {
    if (!groupId) return;
    let alive = true;
    api.group(groupId)
      .then((g) => {
        if (!alive) return;
        setTitle(g.title || '');
        setDate(String(g.date).slice(0, 10));
        const saved = g.form?.shape ? g.form : null;
        setForm(saved && {
          ...saved,
          people: saved.people?.map((p) => ({ ...p, key: key() })),
          rows: saved.rows?.map((r) => ({ ...r, key: key() })),
        });
        if (!saved) setError('This split was saved by an older version, so it cannot be reopened here.');
        setLoading(false);
      })
      .catch((err) => { if (alive) { setError(err.message); setLoading(false); } });
    return () => { alive = false; };
  }, [groupId]);

  const patch = (changes) => setForm((f) => ({ ...f, ...changes }));
  const patchRow = (k, changes) =>
    setForm((f) => ({ ...f, rows: f.rows.map((r) => (r.key === k ? { ...r, ...changes } : r)) }));
  const patchPerson = (k, changes) =>
    setForm((f) => ({ ...f, people: f.people.map((p) => (p.key === k ? { ...p, ...changes } : p)) }));

  const scrollToTail = () =>
    requestAnimationFrame(() => tailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));

  const pick = (id) => {
    const method = methods[0] || 'Cash';
    setForm(id === 'bill' ? blankBill(method) : blankFlow(id, method));
  };

  /* One tap for the arithmetic nobody wants to do at a table: the bill divided
     by however many are in it, with the rounding remainder landing on you
     rather than being left over. */
  const splitEqually = () => {
    const total = paise(form.total);
    const n = form.people.length;
    if (!(total > 0) || !n) return;
    const each = Math.floor((total / n) * 100) / 100;
    setForm((f) => ({
      ...f,
      people: f.people.map((p, i) => ({ ...p, share: String(i === 0 ? paise(total - each * (n - 1)) : each) })),
    }));
  };

  const derived = useMemo(() => (form ? derive(form) : null), [form]);
  const issues = useMemo(() => (form ? problems(form, money) : ['']), [form, currency]);
  const ready = !!form && !issues.length && !loading;

  /* A split is one moment: what arrives and what leaves do so together, so a
     wallet is short only if the whole thing leaves it short. */
  const shortWallet = useMemo(() => {
    if (!wallets || !derived) return null;
    const net = derived.received - derived.paid;
    if (net >= -0.005) return null;
    const have = wallets.find((w) => w.name === form.method)?.balance ?? 0;
    return -net > have + 0.005 ? { name: form.method, have, needs: -net } : null;
  }, [wallets, derived, form]);

  async function save() {
    if (shortWallet) {
      setAlert({
        title: `Not enough in ${shortWallet.name}`,
        message:
          `${shortWallet.have <= 0.005 ? `${shortWallet.name} is empty.` : `${shortWallet.name} only has ${money(shortWallet.have)}.`} ` +
          `This needs ${money(shortWallet.needs)}. Pick another wallet, or if ${shortWallet.name} already held money ` +
          `before you started logging here, set its opening balance in Settings → Wallets.`,
      });
      return;
    }
    setSaving(true);
    setError('');
    const body = {
      date,
      title: title.trim() || defaultTitle(form),
      received: derived.received,
      paid: derived.paid,
      total: derived.total,
      form,
      parts: derived.parts,
    };
    try {
      if (groupId) await api.updateGroup(groupId, body);
      else await api.createGroup(body);
      notify(groupId ? 'Split updated' : 'Split saved');
      refresh();
      closeSplit();
    } catch (err) {
      if (err.code === 'INSUFFICIENT_FUNDS') setAlert({ title: 'Not enough in that wallet', message: err.message });
      else setError(err.message);
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this split and everything it recorded?')) return;
    setSaving(true);
    try {
      await api.deleteGroup(groupId);
      notify('Split deleted');
      refresh();
      closeSplit();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Sheet title="Split entry" onClose={closeSplit}>
        <div className="skel" style={{ height: 120, borderRadius: 12 }} />
      </Sheet>
    );
  }

  // ── Nothing chosen yet ──────────────────────────────────────────────────
  if (!form) {
    return (
      <Sheet title="What happened?" subtitle="One thing that meant more than one thing" onClose={closeSplit}>
        {error && <div className="error-msg" role="alert">{error}</div>}
        <div className="shapes">
          {SHAPES.map((s) => (
            <button key={s.id} type="button" className="shape" onClick={() => pick(s.id)}>
              <span className="shape-ico">{s.icon}</span>
              <span className="shape-body">
                <b>{s.title}</b>
                <span>{s.hint}</span>
              </span>
              <IconChevronRight />
            </button>
          ))}
        </div>
      </Sheet>
    );
  }

  const isBill = form.shape === 'bill';
  const reasons = REASONS[form.direction] || [];
  const rowsTotal = isBill ? 0 : form.rows.reduce((n, x) => n + paise(x.amount), 0);
  const left = isBill ? 0 : paise(paise(form.amount) - rowsTotal);

  const walletField = (
    <div className="field">
      <label className="field-label" htmlFor="sp-wallet">Wallet</label>
      <select id="sp-wallet" className="input" value={form.method} onChange={(e) => patch({ method: e.target.value })}>
        {methods.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  );

  return (
    <Sheet
      title={isBill ? 'Shared bill' : form.direction === 'in' ? 'Money came to me' : 'Money I paid out'}
      subtitle={groupId ? 'Editing a saved split' : undefined}
      onClose={closeSplit}
    >
      {error && <div className="error-msg" role="alert">{error}</div>}

      {!groupId && (
        <button type="button" className="backlink" onClick={() => setForm(null)}>&larr; Something else happened</button>
      )}

      {isBill ? (
        <>
          <div className="field field--lead">
            <label className="field-label" htmlFor="sp-total">What did the bill come to?</label>
            <div className="amount-field">
              <span className="amount-cur">{currency}</span>
              <input
                id="sp-total" type="number" inputMode="decimal" placeholder="0" autoFocus
                className="amount-input" value={form.total}
                onChange={(e) => patch({ total: e.target.value })}
              />
            </div>
          </div>

          <div className="row-2">
            <div className="field">
              <label className="field-label" htmlFor="sp-cat">What for?</label>
              <select id="sp-cat" className="input" value={form.category || categories[0] || ''}
                      onChange={(e) => patch({ category: e.target.value })}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="sp-payer">Who paid it?</label>
              <select id="sp-payer" className="input" value={form.payer} onChange={(e) => patch({ payer: e.target.value })}>
                <option value={ME}>I did</option>
                {form.people.filter((p) => p.name !== ME && p.name.trim()).map((p) => (
                  <option key={p.key} value={p.name.trim()}>{p.name.trim()}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <span className="field-label">
              Who shared it, and for how much
              <button type="button" className="field-fill" onClick={splitEqually} disabled={!(paise(form.total) > 0)}>
                Split equally
              </button>
            </span>

            <div className="shares">
              {form.people.map((p, i) => (
                <div className="share" key={p.key}>
                  {p.name === ME ? (
                    <span className="share-me">Me</span>
                  ) : (
                    <input
                      className="input share-name" list="known-people" placeholder="Their name" autoComplete="off"
                      value={p.name}
                      onChange={(e) => {
                        const was = p.name.trim();
                        const now = e.target.value;
                        patchPerson(p.key, { name: now });
                        // Keep "who paid" pointing at the person that was renamed.
                        if (form.payer === was) patch({ payer: now.trim() || ME });
                      }}
                    />
                  )}
                  <div className="share-amt">
                    <span>{currency}</span>
                    <input
                      type="number" inputMode="decimal" placeholder="0"
                      aria-label={p.name === ME ? 'My share' : `Share for ${p.name || 'this person'}`}
                      value={p.share} onChange={(e) => patchPerson(p.key, { share: e.target.value })}
                    />
                  </div>
                  <button
                    type="button" className="icon-btn icon-btn--plain" disabled={i < 2}
                    aria-label="Remove from the split"
                    onClick={() => setForm((f) => ({
                      ...f,
                      payer: f.payer === p.name.trim() ? ME : f.payer,
                      people: f.people.filter((x) => x.key !== p.key),
                    }))}
                  >
                    <IconTrash />
                  </button>
                </div>
              ))}
            </div>

            <div ref={tailRef}>
              <button
                type="button" className="btn btn--ghost btn--block btn--sm"
                disabled={form.people.length >= 12}
                onClick={() => { setForm((f) => ({ ...f, people: [...f.people, { key: key(), name: '', share: '' }] })); scrollToTail(); }}
              >
                <IconPlus /> Add someone
              </button>
            </div>
          </div>

          {form.payer !== ME && (
            <label className="check">
              <input type="checkbox" checked={!!form.carried} onChange={(e) => patch({ carried: e.target.checked })} />
              <span className="check-body">
                <b>Their cash went through my hands</b>
                <span>They gave you the money and you handed it over at the counter.</span>
              </span>
            </label>
          )}

          <div className="row-2">
            <div className="field">
              <label className="field-label" htmlFor="sp-date">Date</label>
              <input id="sp-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {walletField}
          </div>
        </>
      ) : (
        <>
          <div className="field field--lead">
            <label className="field-label" htmlFor="sp-amt">
              {form.direction === 'in' ? 'How much came in?' : 'How much went out?'}
            </label>
            <div className="amount-field">
              <span className="amount-cur">{currency}</span>
              <input
                id="sp-amt" type="number" inputMode="decimal" placeholder="0" autoFocus
                className={`amount-input tone-text-${form.direction === 'in' ? 'in' : 'out'}`}
                value={form.amount} onChange={(e) => patch({ amount: e.target.value })}
              />
            </div>
          </div>

          <div className="row-2">
            <div className="field">
              <label className="field-label" htmlFor="sp-person">
                {form.direction === 'in' ? 'Who from?' : 'Who to?'}
              </label>
              <input
                id="sp-person" className="input" list="known-people" placeholder="Name" autoComplete="off"
                value={form.person} onChange={(e) => patch({ person: e.target.value })}
              />
            </div>
            {walletField}
          </div>

          <div className="field">
            <span className="field-label">What was it made up of?</span>
            <div className="shares">
              {form.rows.map((r, i) => {
                const reason = reasonOf(form.direction, r.reason);
                const canFill = left > 0.005 && !(paise(r.amount) > 0);
                return (
                  <div className="part2" key={r.key}>
                    <div className="share">
                      <div className="share-amt share-amt--lead">
                        <span>{currency}</span>
                        <input
                          type="number" inputMode="decimal" placeholder="0" aria-label={`Amount for part ${i + 1}`}
                          value={r.amount} onChange={(e) => patchRow(r.key, { amount: e.target.value })}
                        />
                      </div>
                      <select
                        className="input share-reason" aria-label={`What part ${i + 1} was`}
                        value={r.reason} onChange={(e) => patchRow(r.key, { reason: e.target.value })}
                      >
                        {reasons.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                      </select>
                      <button
                        type="button" className="icon-btn icon-btn--plain" disabled={form.rows.length <= 2}
                        aria-label={`Remove part ${i + 1}`}
                        onClick={() => setForm((f) => ({ ...f, rows: f.rows.filter((x) => x.key !== r.key) }))}
                      >
                        <IconTrash />
                      </button>
                    </div>

                    {canFill && (
                      <button type="button" className="restlink" onClick={() => patchRow(r.key, { amount: String(left) })}>
                        use the remaining {money(left)}
                      </button>
                    )}

                    {reason.needs === 'category' && (
                      <select className="input part2-extra" aria-label="Category"
                              value={r.category || categories[0] || ''} onChange={(e) => patchRow(r.key, { category: e.target.value })}>
                        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
                    {reason.needs === 'source' && (
                      <select className="input part2-extra" aria-label="Source"
                              value={r.source || sources[0] || ''} onChange={(e) => patchRow(r.key, { source: e.target.value })}>
                        {sources.map((sx) => <option key={sx} value={sx}>{sx}</option>)}
                      </select>
                    )}
                    {reason.needs === 'goal' && (
                      <select className="input part2-extra" aria-label="Savings bucket"
                              value={r.goal || ''} onChange={(e) => patchRow(r.key, { goal: e.target.value })}>
                        <option value="">General savings</option>
                        {goals.map((g) => <option key={g._id} value={g._id}>{g.name}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>

            <div ref={tailRef}>
              <button
                type="button" className="btn btn--ghost btn--block btn--sm"
                disabled={form.rows.length >= 12}
                onClick={() => {
                  setForm((f) => ({ ...f, rows: [...f.rows, { key: key(), amount: '', reason: reasons[0].id, category: '', source: '', goal: '' }] }));
                  scrollToTail();
                }}
              >
                <IconPlus /> Add a part
              </button>
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="sp-date2">Date</label>
            <input id="sp-date2" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </>
      )}

      <div className="field">
        <label className="field-label" htmlFor="sp-title">
          Call it something <span className="field-note">optional</span>
        </label>
        <input
          id="sp-title" className="input" placeholder={defaultTitle(form)}
          value={title} onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* The ledger's own words, once, at the end -- as sentences to check
          rather than terms you had to pick. */}
      <div className={`outcome${ready ? ' outcome--ok' : ''}`} role="status">
        <span className="outcome-h">{ready ? 'This will record' : 'Not ready yet'}</span>
        {ready
          ? <ul>{derived.parts.map((p, i) => <li key={i}>{describe(p, money)}</li>)}</ul>
          : <p>{issues[0]}</p>}
      </div>

      {shortWallet && (
        <p className="field-warn" role="status">
          {shortWallet.name} has {money(shortWallet.have)} — this needs {money(shortWallet.needs)}.
        </p>
      )}

      <datalist id="known-people">
        {people.map((p) => <option key={p} value={p} />)}
      </datalist>

      <div className="btn-row btn-row--form">
        {groupId && (
          <button className="btn btn--danger btn--icon" onClick={remove} disabled={saving} aria-label="Delete split">
            <IconTrash />
          </button>
        )}
        <button className="btn btn--primary btn--block" onClick={save} disabled={!ready || saving}>
          {saving ? 'Saving…' : groupId ? 'Save changes' : 'Save'}
        </button>
      </div>

      {alert && <Alert title={alert.title} message={alert.message} onClose={() => setAlert(null)} />}
    </Sheet>
  );
}

// A name for the ledger when you did not give it one.
function defaultTitle(form) {
  if (!form) return 'Split entry';
  if (form.shape === 'bill') {
    const others = form.people.filter((p) => p.name !== ME && p.name.trim()).map((p) => p.name.trim());
    return others.length ? `Shared with ${others.join(', ')}` : 'Shared bill';
  }
  const who = String(form.person || '').trim();
  if (form.direction === 'in') return who ? `From ${who}` : 'Money came in';
  return who ? `Paid ${who}` : 'Money paid out';
}
