import { useCallback, useEffect, useRef } from 'react';

/**
 * Small reusable micro-interaction hooks. All are no-ops under reduced-motion and clean up after
 * themselves. They pair with the `.tilt` / `.ripple` CSS in index.css.
 */

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * useTilt — a subtle 3D tilt-toward-cursor for a card/tile. Returns a ref to attach to the
 * element (which must have the `.tilt` class). `max` is the peak rotation in degrees.
 */
export function useTilt(max = 6) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || reduceMotion() || !window.matchMedia?.('(pointer: fine)').matches) return undefined;
    let raf = 0;
    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        el.style.setProperty('--tilt-y', `${(px * max).toFixed(2)}deg`);
        el.style.setProperty('--tilt-x', `${(-py * max).toFixed(2)}deg`);
      });
    };
    const reset = () => {
      el.style.setProperty('--tilt-x', '0deg');
      el.style.setProperty('--tilt-y', '0deg');
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', reset);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', reset);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [max]);
  return ref;
}

/**
 * useRipple — returns an onPointerDown handler that fires a click-origin ripple on the target
 * (which must have the `.ripple` class). Attach as `onPointerDown={ripple}`.
 */
export function useRipple() {
  return useCallback((e) => {
    if (reduceMotion()) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--rx', `${e.clientX - r.left}px`);
    el.style.setProperty('--ry', `${e.clientY - r.top}px`);
    el.removeAttribute('data-ripple');
    // Force reflow so re-adding the attribute restarts the animation.
    // eslint-disable-next-line no-unused-expressions
    void el.offsetWidth;
    el.setAttribute('data-ripple', 'on');
  }, []);
}
