import { useEffect, useRef } from 'react';
import { IconClose } from './Icons.jsx';

/* A bottom sheet on a phone, a centred dialog from tablet width up — same
   markup, the difference is entirely in CSS.

   `footer` pins its content to the bottom of the sheet so the primary action
   never scrolls out of reach on a long form. */
export default function Sheet({ title, subtitle, onClose, footer, children }) {
  const panel = useRef(null);
  const restoreTo = useRef(null);

  useEffect(() => {
    restoreTo.current = document.activeElement;

    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      // Keep Tab inside the dialog: with the page behind it inert, focus
      // escaping to it would be invisible.
      const stops = panel.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!stops.length) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      restoreTo.current?.focus?.();
    };
  }, [onClose]);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Dialog'}
        ref={panel}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <div className="sheet-head">
          <div className="sheet-head-text">
            {title && <h2 className="sheet-title">{title}</h2>}
            {subtitle && <p className="sheet-sub">{subtitle}</p>}
          </div>
          <button className="icon-btn icon-btn--plain" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>

        <div className="sheet-body">{children}</div>

        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>
  );
}
