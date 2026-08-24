import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');       // 'login' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isSignup = mode === 'signup';
  const canSubmit = email.trim() && password.length >= (isSignup ? 8 : 1) && (!isSignup || name.trim());

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setError('');
    try {
      if (isSignup) await signUp(name.trim(), email.trim(), password);
      else await signIn(email.trim(), password);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-mark" aria-hidden="true">₹</div>
        <h1 className="auth-title">My Hisab</h1>
        <p className="auth-sub">
          {isSignup ? 'Create an account to start tracking your money.' : 'Welcome back. Sign in to your money.'}
        </p>

        <div className="chips auth-tabs">
          <button type="button" className="chip" aria-pressed={!isSignup}
                  onClick={() => { setMode('login'); setError(''); }}>Sign in</button>
          <button type="button" className="chip" aria-pressed={isSignup}
                  onClick={() => { setMode('signup'); setError(''); }}>Create account</button>
        </div>

        <form onSubmit={submit}>
          {error && <div className="error">{error}</div>}

          {isSignup && (
            <div className="field">
              <label htmlFor="nm">Your name</label>
              <input id="nm" className="input" value={name} autoComplete="name"
                     onChange={(e) => setName(e.target.value)} placeholder="Rahul" />
            </div>
          )}

          <div className="field">
            <label htmlFor="em">Email</label>
            <input id="em" className="input" type="email" value={email} autoComplete="email"
                   inputMode="email" autoCapitalize="none" spellCheck="false"
                   onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>

          <div className="field">
            <label htmlFor="pw">Password</label>
            <div className="pw-wrap">
              <input id="pw" className="input" type={show ? 'text' : 'password'} value={password}
                     autoComplete={isSignup ? 'new-password' : 'current-password'}
                     onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)}
                      aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
            </div>
            {isSignup && <div className="hint">At least 8 characters.</div>}
          </div>

          <button className="btn btn-in btn-block" type="submit" disabled={!canSubmit || busy}
                  style={{ marginTop: 6 }}>
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="auth-foot">
          {isSignup ? 'Already have an account?' : 'New here?'}{' '}
          <button type="button" className="linkish"
                  onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError(''); }}>
            {isSignup ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
}
