/*
 * Whether this is somebody's first time in the app.
 *
 * Resolved once, when this module is first imported, and deliberately not
 * later: WhatsNew stamps `hisab.version.seen` the moment it mounts, and that
 * stamp is the very thing used below to recognise an established user. Deciding
 * inside an effect would make the answer depend on which component rendered
 * first, which is not a thing to build a first impression on.
 */

const KEY = 'hisab.onboarded.v1';
// Written by WhatsNew on every launch since 2.0.0, so its presence means this
// device has opened an earlier release and needs no tour.
const SEEN_KEY = 'hisab.version.seen';

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window */ } };

function resolve() {
  /* No storage at all — a locked-down private window. Guessing "first run"
     would mean showing the tour on every single launch, which is worse than
     never showing it. */
  try { if (typeof localStorage === 'undefined') return false; } catch { return false; }

  if (read(KEY)) return false;
  if (read(SEEN_KEY)) {
    // Already a user of an earlier release; record it so this is settled once.
    write(KEY, 'established');
    return false;
  }
  return true;
}

const FIRST_RUN = resolve();

/** True only for a genuinely new install, and constant for the whole session. */
export const isFirstRun = () => FIRST_RUN;

/** `how` is kept rather than a bare flag — useful to know if they skipped. */
export const markOnboarded = (how = 'done') => write(KEY, how);
