import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { IconCheck } from '../components/Icons.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import { googleEnabled } from '../lib/google.js';

const PERKS = [
  'Every expense, income and transfer in one ledger',
  'Who owes you, and who you owe, kept straight',
  'Savings buckets with targets you can actually reach',
];

export default function Login() {
  const { signIn, signUp, continueWithGoogle } = useAuth();
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

  const switchTo = (m) => { setMode(m); setError(''); };

  /* Google covers signing up and signing in with one button, so it does not
     change with the tab above it — only the wording does. */
  async function fromGoogle(credential) {
    setBusy(true);
    setError('');
    try {
      await continueWithGoogle(credential);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-panel">
        {/* Shown alongside the form from tablet width up; the phone gets the form alone. */}
        <aside className="auth-pitch">
          <div className="auth-mark" aria-hidden="true">₹</div>
          <h1 className="auth-pitch-title">Every rupee, accounted for.</h1>
          <p className="auth-pitch-sub">
            My Hisab keeps your daily spending, your lending and your savings in one honest picture.
          </p>
          <ul className="auth-perks">
            {PERKS.map((p) => (
              <li key={p}><span className="auth-perk-ico"><IconCheck /></span>{p}</li>
            ))}
          </ul>
        </aside>

        <div className="auth-card">
          <div className="auth-mark auth-mark--sm" aria-hidden="true">₹</div>
          <h2 className="auth-title">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
          <p className="auth-sub">
            {isSignup ? 'It takes a minute, and your data stays yours.' : 'Sign in to pick up where you left off.'}
          </p>

          <div className="seg auth-tabs" role="tablist">
            <button type="button" className="seg-btn" role="tab" aria-selected={!isSignup}
                    onClick={() => switchTo('login')}>Sign in</button>
            <button type="button" className="seg-btn" role="tab" aria-selected={isSignup}
                    onClick={() => switchTo('signup')}>Create account</button>
          </div>

          {error && <div className="error-msg" role="alert">{error}</div>}

          {googleEnabled() && (
            <>
              <GoogleButton
                text={isSignup ? 'signup_with' : 'continue_with'}
                busy={busy}
                onCredential={fromGoogle}
                onError={setError}
              />
              <div className="or-split"><span>or use your email</span></div>
            </>
          )}

          <form onSubmit={submit}>

            {isSignup && (
              <div className="field">
                <label className="field-label" htmlFor="nm">Your name</label>
                <input id="nm" className="input" value={name} autoComplete="name"
                       onChange={(e) => setName(e.target.value)} placeholder="Rahul" />
              </div>
            )}

            <div className="field">
              <label className="field-label" htmlFor="em">Email</label>
              <input id="em" className="input" type="email" value={email} autoComplete="email"
                     inputMode="email" autoCapitalize="none" spellCheck="false"
                     onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="pw">Password</label>
              <div className="pw-wrap">
                <input id="pw" className="input" type={show ? 'text' : 'password'} value={password}
                       autoComplete={isSignup ? 'new-password' : 'current-password'}
                       onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)}
                        aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
              </div>
              {isSignup && (
                <div className="pw-meter" aria-hidden="true">
                  <i className={password.length >= 8 ? 'on' : ''} />
                  <i className={password.length >= 11 ? 'on' : ''} />
                  <i className={password.length >= 14 && /[^a-zA-Z]/.test(password) ? 'on' : ''} />
                  <span>{password.length < 8 ? 'At least 8 characters' : password.length < 12 ? 'Good' : 'Strong'}</span>
                </div>
              )}
            </div>

            <button className="btn btn--primary btn--block btn--lg" type="submit" disabled={!canSubmit || busy}>
              {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <p className="auth-foot">
            {isSignup ? 'Already have an account?' : 'New here?'}{' '}
            <button type="button" className="linkish" onClick={() => switchTo(isSignup ? 'login' : 'signup')}>
              {isSignup ? 'Sign in' : 'Create one'}
            </button>
          </p>
        </div>
      </div>

      <footer className="app-footer">
        <div>Maintained &amp; developed by <span className="brand">Avita Technologies</span></div>
        <div className="ver">
          My Hisab · v{__APP_VERSION__} · <Link className="linkish" to="/privacy-policy">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
