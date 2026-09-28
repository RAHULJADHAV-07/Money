import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { money as fmt, moneyRound, dateShort } from '../lib/format.js';
import { billLine } from '../lib/credit.js';
import CardSheet, { UsageBar, cardColor } from './CardSheet.jsx';
import PayCardSheet from './PayCardSheet.jsx';
import CardSetupSheet from './CardSetupSheet.jsx';
import { IconCard } from './Icons.jsx';

/*
 * The home screen's credit cards — kept in a section of their own, well away
 * from the balance, because none of these figures is money you have. Each
 * card answers four questions: what do I owe, how much can I still spend,
 * what have I spent this cycle, and when must I pay.
 */
export default function CreditCardSection({ cards }) {
  const { currency, settings } = useStore();
  const money = (n) => fmt(n, currency);
  const [open, setOpen] = useState(null);     // { name, mode: 'view' | 'pay' | 'edit' }
  const order = settings?.methods || [];
  const owed = cards.reduce((n, c) => n + c.outstanding, 0);
  const current = open && cards.find((c) => c.name === open.name);

  return (
    <section className="g-cards">
      <div className="section-label">
        Credit cards
        {owed > 0 && <span className="section-count num">{moneyRound(owed, currency)} outstanding</span>}
      </div>
      <div className="cc-rail">
        {cards.map((c) => {
          const line = billLine(c.statement, money);
          const dueNow = c.statement.remaining > 0.005;
          return (
            <div key={c.name} className={`ccard${c.expired ? ' ccard--expired' : ''}`} style={{ '--wc': cardColor(c, order) }}>
              <span className="ccard-top">
                <span className="wname">{c.name}</span>
                <span className="ccard-chip"><IconCard />{c.expired ? 'Expired' : 'Credit'}</span>
              </span>
              <span className="ccard-k">Outstanding</span>
              <span className="wbal num">{money(c.outstanding)}</span>
              {c.limit > 0 && (
                <>
                  <UsageBar card={c} onDark />
                  <span className="wflow num">Available credit {moneyRound(c.available, currency)} of {moneyRound(c.limit, currency)}</span>
                </>
              )}
              <span className="ccard-stats">
                <span><i>Spent this cycle</i><b className="num">{moneyRound(c.cycle.spent, currency)}</b></span>
                <span>
                  <i>Payment due</i>
                  <b>{dueNow && c.statement.dueDate ? dateShort(c.statement.dueDate) : c.cycle.dueDate ? dateShort(c.cycle.dueDate) : 'Not set'}</b>
                </span>
              </span>
              {dueNow && <span className={`ccard-bill ccard-bill--${line.tone}`}>{line.text}</span>}
              <span className="ccard-actions">
                <button type="button" onClick={() => setOpen({ name: c.name, mode: 'view' })}>View statement</button>
                <button type="button" className="is-primary" disabled={c.outstanding <= 0.005}
                        onClick={() => setOpen({ name: c.name, mode: 'pay' })}>Pay card</button>
              </span>
            </div>
          );
        })}
      </div>

      {current && open.mode === 'view' && (
        <CardSheet
          card={current}
          onClose={() => setOpen(null)}
          onPay={() => setOpen({ name: current.name, mode: 'pay' })}
          onEdit={() => setOpen({ name: current.name, mode: 'edit' })}
        />
      )}
      {current && open.mode === 'pay' && <PayCardSheet card={current} onClose={() => setOpen(null)} />}
      {current && open.mode === 'edit' && <CardSetupSheet name={current.name} onClose={() => setOpen(null)} />}
    </section>
  );
}
