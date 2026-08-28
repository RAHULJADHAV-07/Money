import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../lib/theme.js';
import { googleClientId, loadGoogle } from '../lib/google.js';

/*
 * Google's own button, rendered by their script into this container.
 *
 * It has to be theirs: the ID-token flow only hands back a credential from a
 * button Google drew itself, so a hand-styled one is not an option. What is in
 * our hands is the width, the shape and whether it reads light or dark, which
 * is what the props below settle.
 */
export default function GoogleButton({ text = 'continue_with', onCredential, onError, busy = false }) {
  const host = useRef(null);
  const [, , theme] = useTheme();
  const [width, setWidth] = useState(0);

  /* The callbacks live in refs so that a parent re-render — which happens on
     every keystroke in the form beside it — does not tear the button down and
     rebuild it. */
  const handlers = useRef({ onCredential, onError });
  handlers.current = { onCredential, onError };

  // Google wants a pixel width, so the slot it sits in has to be measured.
  useEffect(() => {
    const slot = host.current?.parentElement;
    if (!slot) return undefined;
    const measure = () => setWidth(Math.round(Math.min(400, Math.max(200, slot.clientWidth))));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(slot);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!width || !googleClientId) return undefined;
    let alive = true;

    loadGoogle()
      .then((google) => {
        if (!alive || !host.current) return;
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (res) => res?.credential && handlers.current.onCredential?.(res.credential),
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        host.current.replaceChildren();
        google.accounts.id.renderButton(host.current, {
          type: 'standard',
          theme: theme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          shape: 'pill',
          text,
          logo_alignment: 'center',
          width,
        });
      })
      .catch((err) => alive && handlers.current.onError?.(err.message));

    return () => { alive = false; };
  }, [theme, width, text]);

  return (
    <div className={`gbtn${busy ? ' gbtn--busy' : ''}`}>
      <div ref={host} />
    </div>
  );
}
