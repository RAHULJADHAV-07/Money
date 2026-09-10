import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { watchForUpdates, onUpdateReady, applyUpdate } from '../lib/update.js';
import { IconSync } from './Icons.jsx';

/*
 * Applying a new version, at a moment that will not cost anything.
 *
 * A reload throws away whatever is on screen but unsaved, so it waits until no
 * sheet is open. If one opens during the notice below, the reload is called off
 * and waits for the next quiet moment — there is no hurry, and the old version
 * keeps working perfectly in the meantime.
 *
 * The notice is a panel rather than the toast it used to be. The app is about
 * to reload underneath whoever is reading it; a line sliding past the bottom of
 * the screen is not enough warning for that. The bar counts the wait out so it
 * is clear the app is mid-something rather than stuck, and there is a way to
 * skip it for anyone who would rather not wait.
 */

const NOTICE = 2400;   // long enough to read, short enough not to be a wait

export default function UpdateGate() {
  /* This sits above the sign-in gate, so there may be no store at all -- signed
     out there is nothing half-typed to protect, and the update applies at once. */
  const store = useStore();
  const [ready, setReady] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    watchForUpdates();
    return onUpdateReady(setReady);
  }, []);

  const busy = !!store?.addSheet || !!store?.splitSheet || !!store?.monthSheet;

  useEffect(() => {
    if (!ready || busy) { setApplying(false); return; }
    setApplying(true);
    const t = setTimeout(applyUpdate, NOTICE);
    return () => clearTimeout(t);
  }, [ready, busy]);

  if (!applying) return null;

  return (
    <>
      <div className="update-scrim" />
      <div
        className="update-pop"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="update-t"
        aria-describedby="update-m"
      >
        <span className="update-ico" aria-hidden="true"><IconSync /></span>
        <h2 className="update-title" id="update-t">Updating My Hisab</h2>
        <p className="update-msg" id="update-m">
          A newer version is ready. The app reloads in a moment — everything you
          have saved stays exactly where it is.
        </p>
        {/* Counts the wait out, so this reads as busy rather than as stuck. */}
        <div className="update-bar" aria-hidden="true">
          <i style={{ animationDuration: `${NOTICE}ms` }} />
        </div>
        <button className="btn btn--primary btn--block update-now" onClick={applyUpdate}>
          Reload now
        </button>
      </div>
    </>
  );
}
