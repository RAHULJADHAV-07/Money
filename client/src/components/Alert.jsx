import { useEffect, useRef } from 'react';
import { IconAlert } from './Icons.jsx';

/*
 * A blocking popup for something the app will not do — as opposed to `notify`,
 * which is a toast for something it already did. It sits above the add sheet,
 * so it can explain a refusal without the form underneath disappearing.
 */
export default function Alert({ title, message, action = 'Got it', onClose }) {
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
        <span className="alert-ico" aria-hidden="true"><IconAlert /></span>
        <h2 className="alert-title" id="alert-t">{title}</h2>
        <p className="alert-msg">{message}</p>
        <button className="btn btn--primary btn--block" ref={confirm} onClick={onClose}>{action}</button>
      </div>
    </>
  );
}
