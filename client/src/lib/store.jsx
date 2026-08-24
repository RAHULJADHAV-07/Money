import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, flushOutbox, onOutboxChange, pendingCount } from './api.js';
import { monthKeyNow } from './format.js';

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

  useEffect(() => {
    const sync = async () => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) return;
      const { sent } = await flushOutbox();
      if (sent) { notify(`Synced ${sent} saved ${sent === 1 ? 'entry' : 'entries'}`); refresh(); }
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

  const value = useMemo(() => ({
    settings, month, setMonth, version, refresh,
    online, pending, toast, notify,
    addSheet, openAdd: (opts = {}) => setAddSheet(opts), closeAdd: () => setAddSheet(null),
    currency: settings?.currency || '₹',
  }), [settings, month, version, online, pending, toast, notify, addSheet]);

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
