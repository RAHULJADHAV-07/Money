import { useEffect, useState } from 'react';
import Sheet from './Sheet.jsx';
import Alert from './Alert.jsx';
import { api } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { money as fmt, todayKey, dateShort } from '../lib/format.js';

/*
 * Paying a credit card.
 *
 * One entry, and it is a transfer — money leaving Bank (or Cash) and landing
 * on the card. That single row lowers the bank balance and what is owed on
 * the card together, and because it is not an expense it never shows up as
 * spending: the purchases were counted the day they were made.
 */
export default function PayCardSheet({ card, onClose }) {
  const { refresh, notify, currency } = useStore();
  const money = (n) => fmt(n, currency);
  const st = card.statement;

  const [wallets, setWallets] = useState(null);
  const [from, setFrom] = useState('');
  const [amount, setAmount] = useState(() => String(st.remaining > 0 ? st.remaining : card.outstanding || ''));
  const [date, setDate] = useState(todayKey);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  // Only real money can pay a card: never another card.
  useEffect(() => {
    api.wallets().then((r) => {
      const real = r.wallets.filter((w) => !w.credit);
      setWallets(real);
      setFrom((f) => f || [...real].sort((a, b) => b.balance - a.balance)[0]?.name || '');
    }).catch(() => setWallets([]));
  }, []);

  const paying = Number(amount) || 0;
  const source = wallets?.find((w) => w.name === from);
  const short = source && paying > source.balance + 0.005;
  const over = paying - card.outstanding;

  const quick = [
    st.remaining > 0.005 && ['Statement balance', st.remaining],
    card.outstanding > 0.005 && Math.abs(card.outstanding - st.remaining) > 0.005 && ['Full outstanding', card.outstanding],
    st.remainingMin > 0.005 && st.remainingMin < st.remaining && ['Minimum due', st.remainingMin],
  ].filter(Boolean);

  async function pay() {
    if (short) {
      setAlert({ title: `Not enough in ${from}`, message: `${from} has ${money(source.balance)}. Pay less, or pay from another wallet.` });
      return;
    }
    setSaving(true);
    try {
      await api.createTx({
        kind: 'transfer', amount: paying, date, method: from, toMethod: card.name,
        note: `${card.name} card payment`,
      });
      notify(`${money(paying)} paid to ${card.name}`);
      refresh();
      onClose();
    } catch (err) {
      setAlert({ title: 'Could not record the payment', message: err.message });
      setSaving(false);
    }
  }

  return (
    <Sheet
      title={`Pay ${card.name}`} subtitle="Credit card payment" onClose={onClose}
      footer={(
        <button className="btn btn--primary btn--block" onClick={pay} disabled={!(paying > 0) || !from || saving}>
          {saving ? 'Saving…' : `Pay ${paying > 0 ? money(paying) : ''}`}
        </button>
      )}
    >
      <div className="kv-grid kv-grid--tight">
        <div className="kv"><span className="kv-k">Outstanding</span><span className="kv-v num">{money(card.outstanding)}</span></div>
        <div className="kv">
          <span className="kv-k">Statement due{st.dueDate ? ` · ${dateShort(st.dueDate)}` : ''}</span>
          <span className="kv-v num">{money(st.remaining)}</span>
        </div>
      </div>

      <div className="field field--lead">
        <label className="field-label" htmlFor="pay-amt">Amount</label>
        <div className="amount-field">
          <span className="amount-cur">{currency}</span>
          <input id="pay-amt" type="number" inputMode="decimal" placeholder="0" className="amount-input"
                 value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </div>
        {quick.length > 0 && (
          <div className="chips">
            {quick.map(([label, v]) => (
              <button key={label} type="button" className={`chip${Math.abs(paying - v) < 0.005 ? ' is-on' : ''}`}
                      onClick={() => setAmount(String(v))}>
                {label} · {money(v)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="row-2">
        <div className="field">
          <label className="field-label" htmlFor="pay-from">
            Paid from{source && <span className={`field-note${short ? ' field-note--neg' : ''}`}>{money(source.balance)}</span>}
          </label>
          <select id="pay-from" className="input" value={from} onChange={(e) => setFrom(e.target.value)}>
            {(wallets || []).map((w) => <option key={w.name} value={w.name}>{w.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="pay-date">Date</label>
          <input id="pay-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {paying > 0 && (
        <div className="cc-preview">
          <div><span>Outstanding after</span><b className="num">{money(Math.max(0, card.outstanding - paying))}</b></div>
          {card.limit > 0 && <div><span>Available credit after</span><b className="num">{money(card.available + paying)}</b></div>}
          {source && <div><span>{from} after</span><b className="num">{money(source.balance - paying)}</b></div>}
        </div>
      )}
      {over > 0.005 && (
        <p className="field-warn">That is {money(over)} more than you owe — the card will be in credit by that much.</p>
      )}
      <p className="hint">
        Recorded as a transfer from {from || 'your wallet'} to {card.name}. It is not spending — each purchase was
        counted when you made it.
      </p>

      {alert && <Alert title={alert.title} message={alert.message} onClose={() => setAlert(null)} />}
    </Sheet>
  );
}
