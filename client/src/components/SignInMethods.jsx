import { useState } from 'react';
import Alert from './Alert.jsx';
import { auth as authApi } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { googleEnabled } from '../lib/google.js';
import GoogleButton from './GoogleButton.jsx';
import { IconUser, IconCheck, IconClose, IconEye, IconEyeOff } from './Icons.jsx';

/* A password box you can look at. Typing a password you cannot see is how
   people set one they cannot repeat, and each box keeps its own eye so showing
   the new one does not reveal the old. */
function PasswordField({ id, label, value, onChange, autoComplete, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="pw-wrap pw-wrap--icon">
        <input
          id={id} className="input" type={show ? 'text' : 'password'} value={value}
          autoComplete={autoComplete} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button" className="pw-toggle pw-toggle--icon"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
        >
          {show ? <IconEyeOff /> : <IconEye />}
        </button>
      </div>
    </div>
  );
}

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
  const [confirmUnlink, setConfirmUnlink] = useState(false);

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
            <PasswordField
              id="cpw" label="Current password" value={current} onChange={setCurrent}
              autoComplete="current-password" placeholder="••••••••"
            />
          )}
          <PasswordField
            id="npw" label={hasPassword ? 'New password' : 'Choose a password'}
            value={next} onChange={setNext}
            autoComplete="new-password" placeholder="At least 8 characters"
          />
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
              <button className="btn btn--sm btn--ghost" onClick={() => setConfirmUnlink(true)}
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

      {confirmUnlink && (
        <Alert
          danger tone="danger"
          title="Disconnect Google?"
          message="You will sign in with your email and password instead. Your data is untouched."
          action="Disconnect" cancel="Stay connected"
          onConfirm={() => { setConfirmUnlink(false); disconnectGoogle(); }}
          onClose={() => setConfirmUnlink(false)}
        />
      )}
    </div>
  );
}
