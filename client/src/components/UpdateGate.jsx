import { useEffect, useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { watchForUpdates, onUpdateReady, applyUpdate } from '../lib/update.js';
import { IconSync } from './Icons.jsx';

/*
 * Applying a new version, at a moment that will not cost anything.
 *
 * A reload throws away whatever is on screen but unsaved, so it waits until no
 * sheet is open. If one opens during the short notice below, the reload is
 * called off and waits for the next quiet moment — there is no hurry, and the
 * old version keeps working perfectly in the meantime.
 */
export default function UpdateGate() {
  const { addSheet, splitSheet, monthSheet } = useStore();
  const [ready, setReady] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    watchForUpdates();
    return onUpdateReady(setReady);
  }, []);

  const busy = !!addSheet || !!splitSheet || monthSheet;

  useEffect(() => {
    if (!ready || busy) { setApplying(false); return; }
    setApplying(true);
    // Long enough to read, short enough not to be a wait.
    const t = setTimeout(applyUpdate, 1600);
    return () => clearTimeout(t);
  }, [ready, busy]);

  if (!applying) return null;

  return (
    <div className="updating" role="status">
      <span className="updating-ico"><IconSync /></span>
      <span>Updating to the latest version…</span>
    </div>
  );
}
