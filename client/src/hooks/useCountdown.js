/**
 * useCountdown — ticks every second toward a target ISO instant. Returns { ms, done, label }.
 * Used by session ETA timers, queue grace/claim windows, and emergency response windows.
 */
import { useEffect, useRef, useState } from 'react';
import { msUntil, msSince, formatCountdown } from '@/utils/time.js';

export function useCountdown(targetIso, { onDone } = {}) {
  const [ms, setMs] = useState(() => msUntil(targetIso));
  // Keep the latest onDone in a ref so the interval always fires the current callback.
  // The effect intentionally re-runs only on targetIso; without this, a parent that passes
  // a fresh onDone each render (closing over changing state) would fire a stale one.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    setMs(msUntil(targetIso));
    if (!targetIso) return undefined;
    const id = setInterval(() => {
      const remaining = msUntil(targetIso);
      setMs(remaining);
      if (remaining <= 0) {
        clearInterval(id);
        onDoneRef.current?.();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIso]);

  return { ms, done: ms <= 0, label: formatCountdown(ms) };
}

/** Like useCountdown, but ticks upward from a past ISO instant instead of clamping at 0. */
export function useElapsed(sinceIso) {
  const [ms, setMs] = useState(() => msSince(sinceIso));

  useEffect(() => {
    setMs(msSince(sinceIso));
    if (!sinceIso) return undefined;
    const id = setInterval(() => setMs(msSince(sinceIso)), 1000);
    return () => clearInterval(id);
  }, [sinceIso]);

  return { ms, label: formatCountdown(ms) };
}
