/*
 * Keeping the add sheet above the on-screen keyboard.
 *
 * `interactive-widget=resizes-content` in the viewport meta handles this on
 * Chrome for Android: the layout viewport shrinks, so a bottom-anchored sheet
 * and every dvh unit shrink with it. Safari on iOS ignores that setting — it
 * only shrinks the *visual* viewport and leaves the layout alone, which parks
 * the sheet underneath the keyboard.
 *
 * So the overlap is measured and published as `--kb` for the CSS to lift by.
 * Where the meta tag already worked, the overlap measures ~0 and this changes
 * nothing, so the two never fight each other.
 */
const MIN_OVERLAP = 24;   // smaller than this is browser chrome, not a keyboard

export function watchKeyboard() {
  const vv = window.visualViewport;
  if (!vv) return () => {};

  const root = document.documentElement;
  const apply = () => {
    const overlap = window.innerHeight - vv.height - vv.offsetTop;
    root.style.setProperty('--kb', overlap > MIN_OVERLAP ? `${Math.round(overlap)}px` : '0px');
  };

  apply();
  vv.addEventListener('resize', apply);
  vv.addEventListener('scroll', apply);
  return () => {
    vv.removeEventListener('resize', apply);
    vv.removeEventListener('scroll', apply);
    root.style.setProperty('--kb', '0px');
  };
}
