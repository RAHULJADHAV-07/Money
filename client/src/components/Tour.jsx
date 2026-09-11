import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { useStore } from '../lib/store.jsx';
import { markOnboarded } from '../lib/onboarding.js';
import { IconChevronLeft } from './Icons.jsx';

/*
 * A walk through the actual app, not a slideshow about it.
 *
 * Each step names a route and an element, and the tour goes there: it
 * navigates, waits for the thing to exist, scrolls it into view, cuts a hole in
 * the dimming around it and puts a card beside it. What is behind the dimming is
 * the real screen, and it stays live -- the overlay takes no pointer events -- so
 * the opening-balance step is somewhere you can actually type rather than a
 * picture of somewhere you can type.
 *
 * Steps whose element is not on the page are skipped rather than shown against
 * nothing. That is not an edge case but the normal state of a new account: the
 * wallet rail and the one-tap row only render once there is something in them,
 * which on day one there is not.
 *
 * Settings comes first on purpose. Every wallet starts empty, and an entry that
 * would take one below zero is refused -- so without opening balances the very
 * first expense someone tries to record is turned away with no explanation.
 */

const STEPS = [
  {
    route: '/settings', anchor: 'opening', place: 'bottom',
    title: 'Start with what you have',
    body: 'What each wallet held before you started logging here — everything you add moves up or down from these. Type straight into the page and press Save; the tour stays where it is.',
    /* Only worth saying to someone who has not logged anything yet. Replaying
       the tour later, it would be advice to go and change a figure that every
       balance in the app is already counted from. */
    why: 'Worth doing now: an entry that would take a wallet below zero is refused, so an empty wallet cannot pay for your first expense.',
    whyWhenFresh: true,
  },
  {
    route: '/', anchor: 'balance', place: 'bottom',
    title: 'Everything adds up to here',
    body: 'Your balance in hand, with what you spent and received today underneath it. It moves the moment you log anything.',
  },
  {
    route: '/', anchor: 'wallets', place: 'bottom', optional: true,
    title: 'Where your money sits',
    body: 'One card per wallet, each showing what is actually in it. Tap one to see only what went through it.',
  },
  {
    route: '/', anchor: 'add', place: 'left',
    title: 'Add anything, from anywhere',
    body: 'This button works on every screen. Amount first — expense, income and transfer are right there, and lending, repayments and savings are one tap further.',
  },
  {
    route: '/ledger', anchor: 'search', place: 'bottom',
    title: 'Everything you logged',
    body: 'Every entry you have ever made, newest first. Search by note, person or category.',
  },
  {
    route: '/ledger', anchor: 'filters', place: 'bottom',
    title: 'Narrow it two ways',
    body: 'By what kind of entry it was, and by which wallet paid for it — and the wallet list shows what each one holds.',
  },
  {
    route: '/people', anchor: 'people', place: 'bottom',
    title: 'Who owes whom',
    body: 'Log what you lend and what you borrow and this nets it off per person, so one settled friend never hides another’s dues.',
  },
  {
    route: '/savings', anchor: 'savings', place: 'bottom',
    title: 'Money set aside',
    body: 'Buckets with targets. Money moved here leaves your balance in hand but stays yours — it is saved, not spent.',
  },
  {
    route: '/', anchor: 'nav', place: 'top',
    title: 'That is the whole app',
    body: 'Five screens, and one button that works on all of them. Everything else you will find as you go.',
    last: true,
  },
];

const GAP = 14;        // between the highlight and the card
const PAD = 8;         // breathing room around the highlighted element
const GIVE_UP = 2500;  // ms to wait for an element before deciding it is absent

export default function Tour() {
  const { user } = useAuth();
  const { tour, endTour } = useStore();
  const fresh = !!tour?.fresh;
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);      // null while looking, or absent
  const [absent, setAbsent] = useState(false);
  /* Where they were when this started. The tour walks them across the whole app,
     so finishing on whatever screen the last step happened to be about would
     strand someone who only wanted to watch it from Settings. */
  const startedAt = useRef(pathname);
  const cardRef = useRef(null);
  const [cardBox, setCardBox] = useState({ w: 340, h: 200 });

  const step = STEPS[i];
  const onRoute = pathname === step.route;

  const leave = useCallback((how) => {
    markOnboarded(user?.id, how);
    endTour();
    if (startedAt.current && startedAt.current !== pathname) navigate(startedAt.current);
  }, [user?.id, endTour, navigate, pathname]);
  const next = useCallback(() => {
    setI((n) => (n < STEPS.length - 1 ? n + 1 : n));
  }, []);

  // ── get to the page this step is about ────────────────────────────────────
  useEffect(() => {
    if (!onRoute) navigate(step.route);
  }, [onRoute, step.route, navigate]);

  // ── find the element, then keep track of where it is ──────────────────────
  const find = useCallback(() => {
    const el = document.querySelector(`[data-tour="${step.anchor}"]`);
    if (!el) return null;
    const b = el.getBoundingClientRect();
    // Present in the markup but not on screen — the FAB on a layout that hides
    // it, a section collapsed to nothing. Same as not being there.
    return b.width > 4 && b.height > 4 ? { el, b } : null;
  }, [step.anchor]);

  useEffect(() => {
    setRect(null);
    setAbsent(false);
    if (!onRoute) return undefined;

    let alive = true;
    let raf = 0;
    const start = performance.now();

    const look = () => {
      if (!alive) return;
      const hit = find();
      if (hit) {
        /* Instant, not smooth: the measurement below has to describe where the
           element has come to rest, and a smooth scroll is still moving. */
        hit.el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
        const b = hit.el.getBoundingClientRect();
        setRect({ top: b.top, left: b.left, width: b.width, height: b.height });
        return;
      }
      if (performance.now() - start > GIVE_UP) { setAbsent(true); return; }
      raf = requestAnimationFrame(look);
    };
    raf = requestAnimationFrame(look);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, [i, onRoute, find]);

  // Nothing there and nothing lost by moving on.
  useEffect(() => {
    if (absent && step.optional && !step.last) next();
  }, [absent, step.optional, step.last, next]);

  // The page can still move under us — a sheet closing, the keyboard, a resize.
  useEffect(() => {
    if (!rect) return undefined;
    /* Fired for every scroll frame, so it only commits when the element has
       actually moved — otherwise this re-renders the card continuously while
       someone is simply scrolling the page behind it. */
    const sync = () => {
      const hit = find();
      if (!hit) return;
      const b = hit.el.getBoundingClientRect();
      setRect((was) => {
        if (was
          && Math.abs(was.top - b.top) < 0.5 && Math.abs(was.left - b.left) < 0.5
          && Math.abs(was.width - b.width) < 0.5 && Math.abs(was.height - b.height) < 0.5) return was;
        return { top: b.top, left: b.left, width: b.width, height: b.height };
      });
    };
    window.addEventListener('scroll', sync, true);
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('scroll', sync, true);
      window.removeEventListener('resize', sync);
    };
  }, [rect, find]);

  // The card's own size decides where it can go, so it has to be measured.
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (el) setCardBox({ w: el.offsetWidth, h: el.offsetHeight });
  }, [i, rect]);

  // Escape leaves, like every other overlay in the app.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') leave('skipped');
      if (e.key === 'ArrowRight' && !step.last) next();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [leave, next, step.last]);

  const centred = !rect;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // ── where the card goes ───────────────────────────────────────────────────
  let cardStyle;
  if (centred) {
    cardStyle = { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
  } else {
    const hole = { ...rect };
    let place = step.place;
    // Fall back to whichever side there is actually room on.
    if (place === 'bottom' && hole.top + hole.height + GAP + cardBox.h > vh - 12) place = 'top';
    if (place === 'top' && hole.top - GAP - cardBox.h < 12) place = 'bottom';
    if (place === 'left' && hole.left - GAP - cardBox.w < 12) place = 'top';

    let top; let left;
    if (place === 'left') {
      left = hole.left - GAP - cardBox.w;
      top = hole.top + hole.height / 2 - cardBox.h / 2;
    } else {
      left = hole.left + hole.width / 2 - cardBox.w / 2;
      top = place === 'top' ? hole.top - GAP - cardBox.h : hole.top + hole.height + GAP;
    }
    // Keep it on screen whatever the element is doing near an edge.
    left = Math.max(12, Math.min(left, vw - cardBox.w - 12));
    top = Math.max(12, Math.min(top, vh - cardBox.h - 12));
    cardStyle = { left: `${Math.round(left)}px`, top: `${Math.round(top)}px` };
  }

  return (
    <>
      {/* The dimming and the hole in it. Takes no pointer events, so the screen
          underneath stays usable — which is the whole point on the first step. */}
      {rect ? (
        <div
          className="tr-hole"
          aria-hidden="true"
          style={{
            top: rect.top - PAD, left: rect.left - PAD,
            width: rect.width + PAD * 2, height: rect.height + PAD * 2,
          }}
        />
      ) : (
        <div className="tr-dim" aria-hidden="true" />
      )}

      <div
        className={`tr-card${centred ? ' tr-card--centre' : ''}`}
        style={cardStyle}
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tr-t"
      >
        <div className="tr-head">
          <span className="tr-count">Step {i + 1} of {STEPS.length}</span>
          <button type="button" className="tr-skip" onClick={() => leave('skipped')}>
            Skip the tour
          </button>
        </div>

        <h2 className="tr-title" id="tr-t">{step.title}</h2>
        <p className="tr-body">{step.body}</p>
        {step.why && (!step.whyWhenFresh || fresh) && <p className="tr-why">{step.why}</p>}

        <div className="tr-foot">
          <div className="tr-dots" aria-hidden="true">
            {STEPS.map((s, n) => <i key={s.title} className={n === i ? 'on' : ''} />)}
          </div>
          <div className="tr-actions">
            {i > 0 && (
              <button type="button" className="btn tr-back" aria-label="Previous step"
                      onClick={() => setI(i - 1)}>
                <IconChevronLeft />
              </button>
            )}
            <button type="button" className="btn btn--primary tr-next"
                    onClick={() => (step.last ? leave('done') : next())}>
              {step.last ? 'Start using My Hisab' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
