import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth as authApi, getToken, setToken, setUnauthorizedHandler } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    try { localStorage.removeItem('hisab.outbox.v1'); } catch { /* ignore */ }
  }, []);

  // Any 401 from anywhere in the app drops straight back to the sign-in screen.
  useEffect(() => { setUnauthorizedHandler(signOut); }, [signOut]);

  // Resume an existing session on load; a stale token just means "sign in again".
  useEffect(() => {
    if (!getToken()) { setChecking(false); return; }
    let alive = true;
    authApi.me()
      .then((r) => alive && setUser(r.user))
      .catch(() => alive && setToken(null))
      .finally(() => alive && setChecking(false));
    return () => { alive = false; };
  }, []);

  const finish = (res) => { setToken(res.token); setUser(res.user); return res.user; };

  const value = useMemo(() => ({
    user,
    checking,
    signIn: async (email, password) => finish(await authApi.login({ email, password })),
    signUp: async (name, email, password) => finish(await authApi.signup({ name, email, password })),
    signOut,
  }), [user, checking, signOut]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
