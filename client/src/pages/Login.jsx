import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { auth as authApi } from '../lib/api.js';
import { IconCheck, IconMail } from '../components/Icons.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import { googleEnabled } from '../lib/google.js';

const PERKS = [
  'Every expense, income and transfer in one ledger',
  'Who owes you, and who you owe, kept straight',
  'Savings buckets with targets you can actually reach',
];

export default function Login() {
  const { signIn, signUp, continueWithGoogle } = useAuth();
  const [mode, setMode] = useState('login');       // 'login' | 'signup' | 'forgot'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // The address the link went to, which is also what tells the card to say so.
  const [sentTo, setSentTo] = useState('');

  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';
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

  /* The server answers the same way whether or not the address has an account,
     so this screen cannot be used to find out which emails are registered —
     and this side must not undo that by saying anything more specific. */
  async function sendResetLink(e) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await authApi.forgot(email.trim());
      setSentTo(email.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const switchTo = (m) => { setMode(m); setError(''); setSentTo(''); };

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

        {/* ── Forgotten password ──────────────────────────────────────────────
            Its own card rather than a dialog over the form: there is nothing on
            the sign-in form worth preserving once you have admitted you cannot
            get in, and a full card has room to say what happens next. */}
        {isForgot ? (
          <div className="auth-card">
            <div className="auth-mark auth-mark--sm" aria-hidden="true">₹</div>

            {sentTo ? (
              <>
                <span className="auth-sent-ico" aria-hidden="true"><IconMail /></span>
                <h2 className="auth-title">Check your inbox</h2>
                <p className="auth-sub">
                  If <b>{sentTo}</b> has an account, a link to set a new password is on its way.
                  It works for 45 minutes, and only once.
                </p>
                <p className="hint hint--center">
                  Nothing has changed yet — your old password keeps working until you set a new one.
                  Look in spam if it has not arrived in a minute or two.
                </p>
                <button className="btn btn--primary btn--block btn--lg" style={{ marginTop: 18 }}
                        onClick={() => switchTo('login')}>
                  Back to sign in
                </button>
              </>
            ) : (
              <>
                <h2 className="auth-title">Reset your password</h2>
                <p className="auth-sub">
                  Tell us the address you signed up with and we will email you a link to set a new one.
                </p>

                {error && <div className="error-msg" role="alert">{error}</div>}

                <form onSubmit={sendResetLink}>
                  <div className="field">
                    <label className="field-label" htmlFor="fem">Email</label>
                    <input id="fem" className="input" type="email" value={email} autoComplete="email"
                           inputMode="email" autoCapitalize="none" spellCheck="false" autoFocus
                           onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <button className="btn btn--primary btn--block btn--lg" type="submit"
                          disabled={!email.trim() || busy}>
                    {busy ? 'Sending…' : 'Email me a link'}
                  </button>
                </form>

                <p className="auth-foot">
                  Remembered it?{' '}
                  <button type="button" className="linkish" onClick={() => switchTo('login')}>Sign in</button>
                </p>
              </>
            )}
          </div>
        ) : (
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
                <label className="field-label" htmlFor="pw">
                  Password
                  {/* Only on the sign-in tab: there is no password to forget
                      while you are still choosing one. */}
                  {!isSignup && (
                    <button type="button" className="linkish field-link"
                            onClick={() => switchTo('forgot')}>
                      Forgot password?
                    </button>
                  )}
                </label>
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
        )}
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
