import { useEffect, useRef, useState } from 'react';
import Sheet from './Sheet.jsx';
import { entriesSince } from '../lib/changelog.js';
import { IconCheck } from './Icons.jsx';

const KEY = 'hisab.version.seen';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v) => { try { localStorage.setItem(KEY, v); } catch { /* private window */ } };

/* Nothing recorded can mean two opposite things, and they must not be confused:
   a first-ever visit, or someone who has been using the app since before it
   started keeping track. A saved sign-in is the tell — this device has been
   here before, so it has genuinely missed everything in the notes. */
const RETURNING = ['hisab.token', 'hisab.outbox.v1'];
const seenBefore = () => {
  try { return RETURNING.some((k) => localStorage.getItem(k) !== null); } catch { return false; }
};

/*
 * What changed, once, after it has already happened.
 *
 * The version is recorded straight away rather than when this is dismissed, so
 * closing the app instead of reading it does not bring the same notes back
 * tomorrow. Someone opening the app for the first time is shown nothing --
 * there is no "new" for them yet.
 */
export default function WhatsNew() {
  const [entries, setEntries] = useState(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    const seen = read();
    write(__APP_VERSION__);
    if (seen === __APP_VERSION__) return;
    // Never tracked before: everything in the notes is new to them, unless this
    // is their first visit — in which case none of it is news at all.
    if (!seen && !seenBefore()) return;

    const list = entriesSince(seen || '0.0.0');
    if (list.length) setEntries(list);
  }, []);

  if (!entries) return null;

  return (
    <Sheet
      title="What's new"
      subtitle={`You are now on v${__APP_VERSION__}`}
      onClose={() => setEntries(null)}
      footer={
        <button className="btn btn--primary btn--block" onClick={() => setEntries(null)}>
          Got it
        </button>
      }
    >
      {entries.map((e) => (
        <section className="release" key={e.version}>
          <div className="release-head">
            <span className="release-v">v{e.version}</span>
            <h3 className="release-t">{e.title}</h3>
          </div>
          <ul className="release-list">
            {e.changes.map((c, i) => (
              <li key={i}><span className="release-tick"><IconCheck /></span>{c}</li>
            ))}
          </ul>
        </section>
      ))}
    </Sheet>
  );
}
