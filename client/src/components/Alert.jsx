import { useEffect, useRef } from 'react';
import { IconAlert, IconCheck } from './Icons.jsx';

/*
 * A blocking popup for something the app will not do — as opposed to `notify`,
 * which is a toast for something it already did. It sits above the add sheet,
 * so it can explain a refusal without the form underneath disappearing.
 *
 * Given `onConfirm` it asks instead of telling, and grows a way to say no. The
 * same panel either way: a question and a refusal should not look like two
 * different parts of the app.
 */
export default function Alert({
  title, message, action = 'Got it', cancel = 'Cancel',
  tone, danger, onConfirm, onClose,
}) {
  const confirm = useRef(null);

  useEffect(() => {
    confirm.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="alert-scrim" onClick={onClose} />
      <div className="alert" role="alertdialog" aria-modal="true" aria-labelledby="alert-t">
        <span className={`alert-ico${tone ? ` tone-${tone}` : ''}`} aria-hidden="true">
          {onConfirm && !danger ? <IconCheck /> : <IconAlert />}
        </span>
        <h2 className="alert-title" id="alert-t">{title}</h2>
        <p className="alert-msg">{message}</p>
        {onConfirm ? (
          <div className="btn-row">
            <button className="btn btn--block" onClick={onClose}>{cancel}</button>
            <button
              className={`btn btn--block ${danger ? 'btn--danger-solid' : 'btn--primary'}`}
              ref={confirm} onClick={onConfirm}
            >
              {action}
            </button>
          </div>
        ) : (
          <button className="btn btn--primary btn--block" ref={confirm} onClick={onClose}>{action}</button>
        )}
      </div>
    </>
  );
}
