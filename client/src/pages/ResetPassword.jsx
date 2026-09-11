import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { auth as authApi, setToken } from '../lib/api.js';
import { IconCheck, IconAlert } from '../components/Icons.jsx';

/*
 * Where the emailed link lands.
 *
 * Public, and mounted above the sign-in gate in App.jsx — someone arriving here
 * cannot sign in by definition, so anything that asked them to would be a
 * closed loop.
 *
 * The token is only tested when it is submitted, not on arrival. Checking it up
 * front would need an endpoint whose only job is to tell a caller whether a
 * token is good, which is a thing worth guessing at; and the link is far more
 * often fine than not, so greeting most people with a spinner to prove it costs
 * more than it gives.
 */
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // A link with nothing on it is worth saying so immediately — there is no
  // password anyone could type here that would work.
  const missing = !token;

  const tooShort = password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = !missing && !tooShort && confirm === password && !busy;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      const res = await authApi.reset({ token, password });
      /* Signed in on the spot: they have just proved they hold the inbox and
         chosen the password, so asking them to type it again is ceremony. The
         token goes in before the redirect so the app boots straight into the
         session rather than bouncing off the sign-in gate. */
      setToken(res.token);
      setDone(true);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  // A full reload rather than a route change, so every provider re-reads the
  // token that was just stored.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => { window.location.replace('/'); }, 1500);
    return () => clearTimeout(t);
  }, [done]);

  return (
    <div className="auth">
      <div className="auth-panel auth-panel--solo">
        <div className="auth-card">
          <div className="auth-mark auth-mark--sm" aria-hidden="true">₹</div>

          {done ? (
            <>
              <span className="auth-sent-ico" aria-hidden="true"><IconCheck /></span>
              <h2 className="auth-title">Password changed</h2>
              <p className="auth-sub">You are signed in. Taking you to your dashboard…</p>
            </>
          ) : missing ? (
            <>
              <span className="auth-sent-ico auth-sent-ico--warn" aria-hidden="true"><IconAlert /></span>
              <h2 className="auth-title">This link is incomplete</h2>
              <p className="auth-sub">
                It is missing the part that proves it came from us. Open the link straight from the
                email, or ask for a new one.
              </p>
              <Link className="btn btn--primary btn--block btn--lg" to="/" style={{ marginTop: 18 }}>
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h2 className="auth-title">Set a new password</h2>
              <p className="auth-sub">Choose something you have not used here before.</p>

              {error && <div className="error-msg" role="alert">{error}</div>}

              <form onSubmit={submit}>
                <div className="field">
                  <label className="field-label" htmlFor="np">New password</label>
                  <div className="pw-wrap">
                    <input id="np" className="input" type={show ? 'text' : 'password'} value={password}
                           autoComplete="new-password" autoFocus placeholder="••••••••"
                           onChange={(e) => setPassword(e.target.value)} />
                    <button type="button" className="pw-toggle" onClick={() => setShow((v) => !v)}
                            aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
                  </div>
                  <div className="pw-meter" aria-hidden="true">
                    <i className={password.length >= 8 ? 'on' : ''} />
                    <i className={password.length >= 11 ? 'on' : ''} />
                    <i className={password.length >= 14 && /[^a-zA-Z]/.test(password) ? 'on' : ''} />
                    <span>{tooShort ? 'At least 8 characters' : password.length < 12 ? 'Good' : 'Strong'}</span>
                  </div>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="np2">Type it again</label>
                  <input id="np2" className="input" type={show ? 'text' : 'password'} value={confirm}
                         autoComplete="new-password" placeholder="••••••••"
                         onChange={(e) => setConfirm(e.target.value)} />
                  {mismatch && <p className="field-warn" role="status">The two do not match yet.</p>}
                </div>

                <button className="btn btn--primary btn--block btn--lg" type="submit" disabled={!canSubmit}>
                  {busy ? 'Saving…' : 'Save and sign in'}
                </button>
              </form>

              <p className="auth-foot">
                <Link className="linkish" to="/">Back to sign in</Link>
              </p>
            </>
          )}
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
