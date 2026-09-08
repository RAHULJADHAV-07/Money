import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, health, flushOutbox, onOutboxChange, pendingCount } from './api.js';
import { monthKeyNow } from './format.js';
import { isNewer } from './version.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [month, setMonth] = useState(monthKeyNow);
  const [version, setVersion] = useState(0);           // bumped after every write
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(pendingCount);
  const [toast, setToast] = useState(null);
  const [addSheet, setAddSheet] = useState(null);      // { kind, person, goal, tx } | null
  const [splitSheet, setSplitSheet] = useState(null);  // { groupId } | {} for a new split
  const [monthSheet, setMonthSheet] = useState(false);
  const [day, setDay] = useState(null);                // 'YYYY-MM-DD' when one day is picked
  /* The ledger opens on everything you have ever logged; a month is something
     you ask for. The dashboard is month-shaped by nature and ignores this. */
  const [allTime, setAllTime] = useState(true);
  /* True while the API is running an older release than this app. The two
     deploy separately, so there is a window after every push where the new
     screens would be calling endpoints that do not exist yet. */
  const [apiBehind, setApiBehind] = useState(false);
  const toastTimer = useRef();

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  const notify = useCallback((message) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => {
    api.settings().then(setSettings).catch(() => setSettings(null));
  }, [version]);

  useEffect(() => onOutboxChange(setPending), []);

  /* Asked once on load, then every half minute only while it is behind — so a
     deploy still in flight resolves itself without anyone reloading, and a
     healthy pair costs exactly one request. */
  useEffect(() => {
    let alive = true;
    let timer;
    const ask = async () => {
      try {
        const h = await health();
        if (!alive) return;
        /* An API that answers but names no version predates the field itself,
           which every release from 2.0.0 on carries — so it is older than this
           app by definition. That is the case during the very deploy this is
           meant to cover, and the one an equality check would miss. */
        const behind = h?.ok === true && (!h.version || isNewer(__APP_VERSION__, h.version));
        setApiBehind(behind);
        if (behind) timer = setTimeout(ask, 30_000);
      } catch {
        // Offline, or the API is asleep. Neither means it is out of date.
        if (alive) setApiBehind(false);
      }
    };
    ask();
    return () => { alive = false; clearTimeout(timer); };
  }, []);

  useEffect(() => {
    const sync = async () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) return;
      const { sent, failed } = await flushOutbox();
      /* A queued entry the server refuses — one that would overdraw a wallet,
         say — is dropped from the queue rather than retried forever. Saying so
         is the difference between "I told you" and an entry quietly vanishing. */
      if (sent || failed) {
        const said = [];
        if (sent) said.push(`Synced ${sent} saved ${sent === 1 ? 'entry' : 'entries'}`);
        if (failed) said.push(`${failed} was rejected — please add ${failed === 1 ? 'it' : 'them'} again`);
        notify(said.join(' · '));
        if (sent) refresh();
      }
    };
    // Named handler: an inline arrow here would be a different function each call,
    // so removeEventListener would never actually detach it.
    const goOffline = () => setOnline(false);
    window.addEventListener('online', sync);
    window.addEventListener('offline', goOffline);
    sync();
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', goOffline);
    };
  }, [notify, refresh]);

  /* Changing month by any route clears a day filter belonging to the old month,
     and means you are asking for that month rather than for everything. */
  const changeMonth = useCallback((m) => {
    setMonth(m);
    setAllTime(false);
    setDay((d) => (d && d.slice(0, 7) === m ? d : null));
  }, []);

  const showAllTime = useCallback(() => { setAllTime(true); setDay(null); }, []);

  const value = useMemo(() => ({
    settings, month, setMonth: changeMonth, version, refresh,
    day, setDay,
    allTime, showAllTime,
    monthSheet, openMonthSheet: () => setMonthSheet(true), closeMonthSheet: () => setMonthSheet(false),
    online, pending, toast, notify, apiBehind,
    addSheet, openAdd: (opts = {}) => setAddSheet(opts), closeAdd: () => setAddSheet(null),
    splitSheet,
    openSplit: (opts = {}) => { setAddSheet(null); setSplitSheet(opts); },
    closeSplit: () => setSplitSheet(null),
    currency: settings?.currency || '₹',
  }), [settings, month, changeMonth, day, allTime, showAllTime, monthSheet, version, online,
       pending, toast, notify, apiBehind, addSheet, splitSheet, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Small fetch-on-mount hook that re-runs whenever a write bumps the store version.
export function useApi(fn, deps = []) {
  const { version } = useStore();
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    fnRef.current()
      .then((data) => alive && setState({ data, loading: false, error: null }))
      .catch((error) => alive && setState({ data: null, loading: false, error: error.message }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, ...deps]);

  return state;
}
