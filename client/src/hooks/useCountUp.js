/**
 * useCountUp — animates a number from 0 up to `target` on mount (and whenever `target` changes),
 * via requestAnimationFrame with an ease-out curve. Returns the current displayed value. Makes
 * stat tiles read as "alive" for near-zero cost. Honors prefers-reduced-motion by snapping
 * straight to the target (no animation).
 *
 * @param {number} target      the final value
 * @param {object} [opts]
 * @param {number} [opts.duration=900]  ms
 * @param {number} [opts.decimals=0]    decimal places to preserve while animating
 */
import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function useCountUp(target, { duration = 900, decimals = 0 } = {}) {
  const end = Number(target) || 0;
  const [value, setValue] = useState(0);
  const rafRef = useRef(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion() || end === 0) {
      setValue(end);
      return undefined;
    }
    const factor = 10 ** decimals;
    const round = (n) => Math.round(n * factor) / factor;
    startRef.current = 0;

    const step = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(round(end * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else setValue(end);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [end, duration, decimals]);

  return value;
}
