import { useState } from 'react';
import { auth as authApi } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { googleEnabled } from '../lib/google.js';
import GoogleButton from './GoogleButton.jsx';
import { IconUser, IconCheck, IconClose } from './Icons.jsx';

/*
 * One account, up to two ways into it. Whichever you started with, this is
 * where you add the other — and it refuses to remove the last one, which would
 * lock you out of your own ledger.
 */
export default function SignInMethods({ notify }) {
  const { user, refreshUser, continueWithGoogle } = useAuth();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const hasPassword = !!user?.hasPassword;
  const hasGoogle = !!user?.google?.connected;

  const reset = () => { setOpen(false); setCurrent(''); setNext(''); setError(''); };

  async function savePassword(e) {
    e.preventDefault();
    if (next.length < 8 || busy) return;
    setBusy(true);
    setError('');
    try {
      await authApi.setPassword({ password: next, ...(hasPassword && { currentPassword: current }) });
      await refreshUser();
      notify(hasPassword ? 'Password changed' : 'Password set — you can now sign in either way');
      reset();
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  }

  async function connectGoogle(credential) {
    setBusy(true);
    setError('');
    try {
      const outcome = await continueWithGoogle(credential);
      await refreshUser();
      notify(outcome === 'already-linked' ? 'Google was already connected' : 'Google connected');
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  }

  async function disconnectGoogle() {
    if (!confirm('Disconnect Google? You will sign in with your email and password instead.')) return;
    setBusy(true);
    setError('');
    try {
      await authApi.disconnectGoogle();
      await refreshUser();
      notify('Google disconnected');
    } catch (err) {
      setError(err.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2 className="card-title"><span className="card-ico"><IconUser /></span>Ways to sign in</h2>
      </div>

      {error && <div className="error-msg" role="alert">{error}</div>}

      <div className="method-row">
        <span className={`method-badge ${hasPassword ? 'on' : ''}`}>{hasPassword ? <IconCheck /> : <IconClose />}</span>
        <span className="method-who">
          <span className="nm">Email and password</span>
          <span className="em">{hasPassword ? user.email : 'Not set up yet'}</span>
        </span>
        <button className="btn btn--sm btn--ghost" onClick={() => (open ? reset() : setOpen(true))} disabled={busy}>
          {open ? 'Cancel' : hasPassword ? 'Change' : 'Set password'}
        </button>
      </div>

      {open && (
        <form className="method-form" onSubmit={savePassword}>
          {hasPassword && (
            <div className="field">
              <label className="field-label" htmlFor="cpw">Current password</label>
              <input id="cpw" className="input" type="password" value={current} autoComplete="current-password"
                     onChange={(e) => setCurrent(e.target.value)} placeholder="••••••••" />
            </div>
          )}
          <div className="field">
            <label className="field-label" htmlFor="npw">{hasPassword ? 'New password' : 'Choose a password'}</label>
            <input id="npw" className="input" type="password" value={next} autoComplete="new-password"
                   onChange={(e) => setNext(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <button className="btn btn--primary btn--block" type="submit" disabled={next.length < 8 || busy}>
            {busy ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
          </button>
        </form>
      )}

      {googleEnabled() && (
        <>
          <div className="method-row">
            <span className={`method-badge ${hasGoogle ? 'on' : ''}`}>{hasGoogle ? <IconCheck /> : <IconClose />}</span>
            <span className="method-who">
              <span className="nm">Google</span>
              <span className="em">{hasGoogle ? 'Connected' : 'Not connected'}</span>
            </span>
            {hasGoogle && (
              <button className="btn btn--sm btn--ghost" onClick={disconnectGoogle}
                      disabled={busy || !hasPassword}
                      title={hasPassword ? undefined : 'Set a password first'}>
                Disconnect
              </button>
            )}
          </div>
          {/* Google's button has a minimum width of its own, so it gets its own
              line rather than fighting the name beside it on a phone. */}
          {!hasGoogle && (
            <GoogleButton text="continue_with" busy={busy} onCredential={connectGoogle} onError={setError} />
          )}
        </>
      )}

      <p className="hint">
        {hasPassword && hasGoogle
          ? 'Both reach this same account and the same data.'
          : hasGoogle
            ? 'Add a password so you can still get in without Google.'
            : 'Connect Google for a one-tap sign-in on your phone.'}
      </p>
    </div>
  );
}
