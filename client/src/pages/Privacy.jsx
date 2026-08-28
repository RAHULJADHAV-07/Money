import { useEffect } from 'react';
import { Link } from 'react-router-dom';

/*
 * A public page: it sits outside the sign-in gate on purpose. A privacy policy
 * you can only read after handing over your details is no use to anyone, and
 * Google's OAuth consent screen has to be able to reach it too.
 */
const UPDATED = '28 August 2026';
const CONTACT = 'rahuljadhav0417@gmail.com';

const SECTIONS = [
  {
    h: 'What this app collects',
    p: ['Only what it needs to be your ledger. There is no hidden collection beyond the list below.'],
    groups: [
      ['Your account', [
        'Your name and email address.',
        'Your password, stored only as a bcrypt hash. The password itself is never written down, and nobody — including us — can read it back.',
      ]],
      ['If you sign in with Google', [
        'Your Google account identifier, email address, name and profile picture URL.',
        'Nothing else from your Google account is requested, and the app cannot see your Gmail, Drive, contacts or anything beyond that basic profile.',
      ]],
      ['What you record', [
        'The entries you add: amount, date, type, category or source, the name you type for someone you lent to or borrowed from, notes, and which wallet the money moved through.',
        'Your savings buckets and their targets.',
        'Your settings: currency, categories, sources, wallets, budgets and opening balances.',
      ]],
      ['Technical records', [
        'Our hosting providers keep ordinary server logs, which include IP addresses and request times. These are used to keep the service running and to investigate faults.',
      ]],
    ],
  },
  {
    h: 'What stays on your device',
    p: ['Your browser holds a few things locally, which never leave your device except where noted:'],
    list: [
      'Your sign-in token, so you stay signed in. It expires after 30 days.',
      'Your theme choice — light, dark or system.',
      'Entries you add while offline, queued until you are back online, at which point they are sent to the server so they can be saved.',
    ],
    after: 'Signing out clears the token and the offline queue.',
  },
  {
    h: 'Where it is kept',
    list: [
      'Your data is stored in a Neon PostgreSQL database hosted on Amazon Web Services in Singapore.',
      'The interface is served by Vercel, and the API runs on Render.',
      'Everything travels over an encrypted HTTPS connection.',
    ],
  },
  {
    h: 'How it is used',
    p: ['Your entries are used for one thing: showing you your own money — balances, what you are owed, what you owe, and your history. They are not analysed for any other purpose.'],
  },
  {
    h: 'What this app does not do',
    list: [
      'No advertising, and no advertising networks.',
      'No analytics, tracking pixels, or third-party trackers of any kind.',
      'Your data is never sold, rented, or shared for marketing.',
      'Your entries are never shared with other users. Every account sees only its own data.',
    ],
  },
  {
    h: 'Who else can see it',
    p: ['Only the companies needed to run the service, and only in that capacity:'],
    list: [
      'Neon — stores the database.',
      'Render — runs the API.',
      'Vercel — serves the app.',
      'Google — only if you choose to sign in with Google.',
      'Gmail — used to send the welcome email when an account is created.',
    ],
    after: 'We may also disclose data if the law requires it.',
  },
  {
    h: 'Email',
    p: ['One welcome email is sent when an account is first created. There are no marketing emails, no newsletters, and no promotional mail of any kind. If something needs to be sent about your account or a change to this policy, that would be sent to the same address.'],
  },
  {
    h: 'Security',
    list: [
      'Passwords are hashed with bcrypt and never stored in a readable form.',
      'Sign-in uses a signed token that expires after 30 days.',
      'Every request for your data is checked against your account, so one account cannot reach another’s entries.',
      'All traffic is encrypted in transit.',
    ],
    after: 'No system is perfectly secure, and this is a small personal project rather than a bank. Please use a password you do not use elsewhere.',
  },
  {
    h: 'Your choices',
    list: [
      'Export everything you have recorded at any time as a CSV file, from Settings → Your data.',
      'Correct or delete any individual entry yourself, whenever you like.',
      'Ask for a copy of your data, or for your account and everything in it to be permanently deleted, by emailing the address below. Deletion is permanent and cannot be undone.',
      'Disconnect Google sign-in from Settings → Ways to sign in, as long as you have set a password first.',
    ],
  },
  {
    h: 'How long it is kept',
    p: ['Your data is kept for as long as your account exists. When you ask for your account to be deleted, your entries, savings buckets and settings are deleted with it.'],
  },
  {
    h: 'Children',
    p: ['This app is not intended for children under 13, and accounts are not knowingly created for them.'],
  },
  {
    h: 'Changes to this policy',
    p: ['If this policy changes in a way that matters, the date at the top will change and, where the change is significant, you will be told by email.'],
  },
];

export default function Privacy() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Privacy Policy · My Hisab';
    return () => { document.title = previous; };
  }, []);

  return (
    <div className="legal">
      <div className="legal-inner">
        <header className="legal-head">
          <div className="legal-mark" aria-hidden="true">₹</div>
          <h1 className="legal-title">Privacy Policy</h1>
          <p className="legal-meta">My Hisab · Last updated {UPDATED}</p>
        </header>

        <div className="legal-lede">
          <p>
            My Hisab is a personal money tracker. Your entries are yours: they are not sold,
            not shared with anyone else, and not analysed for advertising. There are no trackers
            in this app at all.
          </p>
        </div>

        {SECTIONS.map((s) => (
          <section className="legal-sec" key={s.h}>
            <h2>{s.h}</h2>
            {s.p?.map((t) => <p key={t}>{t}</p>)}
            {s.groups?.map(([title, items]) => (
              <div className="legal-group" key={title}>
                <h3>{title}</h3>
                <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
            ))}
            {s.list && <ul>{s.list.map((i) => <li key={i}>{i}</li>)}</ul>}
            {s.after && <p>{s.after}</p>}
          </section>
        ))}

        <section className="legal-sec">
          <h2>Contact</h2>
          <p>
            For anything about your data — a copy of it, a correction, or deletion — write to{' '}
            <a href={`mailto:${CONTACT}`}>{CONTACT}</a> and it will be dealt with.
          </p>
        </section>

        <footer className="legal-foot">
          <Link className="btn btn--primary" to="/">Open My Hisab</Link>
          <p>Maintained &amp; developed by <span className="brand">Avita Technologies</span></p>
        </footer>
      </div>
    </div>
  );
}
