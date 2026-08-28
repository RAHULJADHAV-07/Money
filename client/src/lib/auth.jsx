import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth as authApi, getToken, setToken, setUnauthorizedHandler } from './api.js';
import { forgetGoogleSession } from './google.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const signOut = useCallback(() => {
    setToken(null);
    setUser(null);
    // Otherwise Google would quietly offer the same account straight back.
    forgetGoogleSession();
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
    /* Same call whether this is a first sign-in, a return visit, or connecting
       Google to the account already open — the server works out which. */
    continueWithGoogle: async (credential) => {
      const res = await authApi.google(credential);
      finish(res);
      return res.outcome;
    },
    // After changing how you sign in, the header and Settings must catch up.
    refreshUser: async () => {
      const { user: fresh } = await authApi.me();
      setUser(fresh);
      return fresh;
    },
    signOut,
  }), [user, checking, signOut]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
