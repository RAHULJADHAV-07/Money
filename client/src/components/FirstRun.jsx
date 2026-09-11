import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { markOnboarded } from '../lib/onboarding.js';
import { money } from '../lib/format.js';
import {
  IconSpark, IconPlus, IconWallet, IconPeople, IconTarget, IconCheck, IconChevronLeft,
} from './Icons.jsx';

/*
 * The first five minutes, which decide whether there is a sixth.
 *
 * The last step is the reason this exists. Every wallet starts at zero, and the
 * app refuses an entry that would take a wallet below nothing — deliberately,
 * because a ledger that lets you spend money you do not have is not a ledger.
 * The consequence is that a brand-new account cannot record its first expense
 * until an opening balance is set, and nothing on the dashboard says so. People
 * met a flat refusal on their very first entry and concluded the app was
 * broken. So the tour ends by asking for those balances, right here, rather
 * than pointing at a settings screen and hoping.
 *
 * Skippable at every step, and skipping is recorded as such — a tour you cannot
 * leave is not a welcome, it is a toll gate.
 */

const STEPS = [
  {
    icon: <IconSpark />,
    title: 'Welcome to My Hisab',
    body: 'A place for every rupee that moves — what you spent, what came in, what you lent, and what you have put aside. Four screens and you know where you stand.',
    points: null,
  },
  {
    icon: <IconPlus />,
    title: 'Everything is one entry',
    body: 'The Add button works from any screen. Type the amount first; everything else is optional.',
    points: [
      ['Spent', 'money that left you'],
      ['Received', 'money that arrived'],
      ['Transfer', 'your own money, moved between wallets'],
    ],
    foot: 'Lending, repayments and savings live behind “Other ways to log this”.',
  },
  {
    icon: <IconWallet />,
    title: 'Your money lives in wallets',
    body: 'Cash, UPI, Bank — every entry says which one it came from or went to, so each wallet always shows what is actually in it.',
    foot: 'You can rename them, or add your own, under More → Wallets.',
  },
  {
    icon: <IconPeople />,
    title: 'Loans and savings look after themselves',
    body: 'Record what you lent and what you borrowed and the app nets it off per person, so you always know who owes whom.',
    points: [
      ['People', 'one running figure per person'],
      ['Savings', 'buckets with targets you can reach'],
    ],
  },
  // The last step is built by hand below — it is a form, not a page of prose.
  { icon: <IconTarget />, title: 'Start with what you have', body: null },
];

export default function FirstRun() {
  const { settings, refresh, notify, currency } = useStore();
  const [i, setI] = useState(0);
  const [amounts, setAmounts] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const wallets = settings?.methods?.length ? settings.methods : ['Cash', 'UPI', 'Bank', 'Card'];
  const last = i === STEPS.length - 1;
  const step = STEPS[i];

  // Nothing behind it should scroll while this is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const leave = (how) => { markOnboarded(how); setDone(true); };

  const total = Object.values(amounts).reduce((n, v) => n + (Number(v) || 0), 0);

  async function finish() {
    // Nothing entered is a perfectly good answer; it just means starting at zero.
    if (!total) { leave('done-empty'); return; }
    setSaving(true);
    setError('');
    try {
      /* A patch, not the whole settings object — the endpoint merges, and
         sending back a stale copy of everything else could undo it. The server
         keeps the headline opening figure equal to the sum of these. */
      const filled = Object.fromEntries(
        Object.entries(amounts).map(([k, v]) => [k, Number(v) || 0]).filter(([, v]) => v)
      );
      await api.saveSettings({ openingBalances: filled });
      refresh();
      notify('Opening balances saved');
      leave('done');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (done) return null;

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-t">
      <div className="tour-card">
        <div className="tour-head">
          <span className="tour-count">Step {i + 1} of {STEPS.length}</span>
          <button type="button" className="tour-skip" onClick={() => leave('skipped')}>
            Skip for now
          </button>
        </div>

        <span className="tour-ico" aria-hidden="true">{step.icon}</span>
        <h2 className="tour-title" id="tour-t">{step.title}</h2>

        {last ? (
          <>
            <p className="tour-body">
              How much is in each wallet right now, before anything is logged here?
              This is what the app counts from.
            </p>
            <p className="tour-why">
              Worth doing now: an entry that would take a wallet below zero is refused,
              so a wallet left empty cannot pay for your first expense.
            </p>

            {error && <div className="error-msg" role="alert">{error}</div>}

            <div className="tour-wallets">
              {wallets.map((w) => (
                <label className="tour-wallet" key={w}>
                  <span className="tour-wallet-n">{w}</span>
                  <span className="tour-wallet-in">
                    <span className="tour-wallet-cur">{currency}</span>
                    <input
                      type="number" inputMode="decimal" placeholder="0"
                      value={amounts[w] ?? ''}
                      onChange={(e) => setAmounts({ ...amounts, [w]: e.target.value })}
                    />
                  </span>
                </label>
              ))}
            </div>

            <p className="tour-total">
              {total > 0 ? `Starting balance ${money(total, currency)}` : 'Leave them blank to start at zero.'}
            </p>
          </>
        ) : (
          <>
            <p className="tour-body">{step.body}</p>
            {step.points && (
              <ul className="tour-points">
                {step.points.map(([t, d]) => (
                  <li key={t}>
                    <span className="tour-tick"><IconCheck /></span>
                    <span><b>{t}</b> — {d}</span>
                  </li>
                ))}
              </ul>
            )}
            {step.foot && <p className="tour-why">{step.foot}</p>}
          </>
        )}

        <div className="tour-foot">
          <div className="tour-dots" aria-hidden="true">
            {STEPS.map((s, n) => <i key={s.title} className={n === i ? 'on' : ''} />)}
          </div>
          <div className="tour-actions">
            {i > 0 && (
              <button type="button" className="btn tour-back" onClick={() => setI(i - 1)}
                      aria-label="Previous step">
                <IconChevronLeft />
              </button>
            )}
            {last ? (
              <button type="button" className="btn btn--primary tour-next" onClick={finish} disabled={saving}>
                {saving ? 'Saving…' : total > 0 ? 'Save and start' : 'Start using My Hisab'}
              </button>
            ) : (
              <button type="button" className="btn btn--primary tour-next" onClick={() => setI(i + 1)}>
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
