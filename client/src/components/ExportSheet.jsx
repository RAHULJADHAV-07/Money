import { useState } from 'react';
import Sheet from './Sheet.jsx';
import { api, getToken } from '../lib/api.js';
import { useStore } from '../lib/store.jsx';
import { monthKeyNow, todayKey } from '../lib/format.js';
import { IconDownload, IconCheck } from './Icons.jsx';

/*
 * Choosing what to take away, before taking it.
 *
 * The three formats are the same statement written three ways, so they share
 * one set of questions — which period, and which wallet — rather than each
 * growing its own. The server does the writing: a spreadsheet library and a PDF
 * library are a megabyte of JavaScript each, which is not a thing to post to a
 * phone on a slow connection so that it can make its own file.
 */

const FORMATS = [
  { id: 'pdf', label: 'PDF', hint: 'A statement, laid out like a bank’s' },
  { id: 'xlsx', label: 'Excel', hint: 'Columns, formats and totals that add up' },
  { id: 'csv', label: 'CSV', hint: 'Plain text, opens anywhere' },
];

const PERIODS = [
  { id: 'month', label: 'A month' },
  { id: 'range', label: 'Between two dates' },
  { id: 'all', label: 'Everything' },
];

export default function ExportSheet({ onClose }) {
  const { settings, notify, currency } = useStore();
  const wallets = settings?.methods?.length ? settings.methods : ['Cash', 'UPI', 'Bank', 'Card'];

  const [format, setFormat] = useState('pdf');
  const [period, setPeriod] = useState('month');
  const [month, setMonth] = useState(monthKeyNow);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(todayKey);
  const [wallet, setWallet] = useState('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ready = period !== 'range' || (from && to && from <= to);

  async function download() {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    try {
      const params = { method: wallet };
      if (period === 'month') params.month = month;
      if (period === 'range') { params.from = from; params.to = to; }

      /* The endpoint needs the token, so it cannot simply be a link — the file
         is fetched and handed to the browser as a blob. */
      const res = await fetch(api.exportUrl(format, params), {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Could not prepare that file — please try again.');

      const blob = await res.blob();
      const name = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]
        || `hisab-statement.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      notify('Statement downloaded');
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <Sheet
      title="Export a statement"
      subtitle="Pick a format, a period and a wallet"
      onClose={onClose}
      footer={(
        <button className="btn btn--primary btn--block btn--lg" onClick={download} disabled={!ready || busy}>
          {busy ? 'Preparing…' : <><IconDownload />Download</>}
        </button>
      )}
    >
      {error && <div className="error-msg" role="alert">{error}</div>}

      <div className="ex-k">Format</div>
      <div className="ex-formats">
        {FORMATS.map((f) => (
          <button key={f.id} className="ex-format" aria-pressed={format === f.id}
                  onClick={() => setFormat(f.id)}>
            <span className="ex-format-t">{f.label}{format === f.id && <IconCheck />}</span>
            <span className="ex-format-h">{f.hint}</span>
          </button>
        ))}
      </div>

      <div className="ex-k ex-k--lead">Period</div>
      <div className="seg" role="tablist">
        {PERIODS.map((p) => (
          <button key={p.id} type="button" className="seg-btn" role="tab"
                  aria-selected={period === p.id} onClick={() => setPeriod(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      {period === 'month' && (
        <div className="field" style={{ marginTop: 12 }}>
          <label className="field-label" htmlFor="ex-m">Which month</label>
          <input id="ex-m" className="input" type="month" value={month} max={monthKeyNow()}
                 onChange={(e) => setMonth(e.target.value)} />
        </div>
      )}

      {period === 'range' && (
        <div className="row-2" style={{ marginTop: 12 }}>
          <div className="field">
            <label className="field-label" htmlFor="ex-f">From</label>
            <input id="ex-f" className="input" type="date" value={from} max={to || todayKey()}
                   onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="ex-t">To</label>
            <input id="ex-t" className="input" type="date" value={to} min={from || undefined}
                   onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
      )}

      {period === 'all' && (
        <p className="hint" style={{ marginTop: 10 }}>
          Every entry you have ever logged, oldest first.
        </p>
      )}

      <div className="ex-k ex-k--lead">Wallet</div>
      <div className="ex-wallets">
        <button className="ex-wallet" aria-pressed={wallet === 'all'} onClick={() => setWallet('all')}>
          All wallets
        </button>
        {wallets.map((w) => (
          <button key={w} className="ex-wallet" aria-pressed={wallet === w} onClick={() => setWallet(w)}>
            {w}
          </button>
        ))}
      </div>

      <p className="hint" style={{ marginTop: 14 }}>
        {wallet === 'all'
          ? `A running balance across every wallet, in ${currency}. Transfers between your own wallets net to nothing.`
          : `A running balance for ${wallet} alone, in ${currency} — money moved to or from your other wallets shows as paid in or paid out.`}
      </p>
    </Sheet>
  );
}
