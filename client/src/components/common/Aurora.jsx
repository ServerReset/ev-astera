import { useEffect } from 'react';

/**
 * The living aurora background — three drifting glass-wash layers (see `.aurora` in index.css)
 * plus a fine film-grain overlay. Mounted once at the app root (AppLayout) and on the auth pages,
 * so every route gets the same ambient depth for glass surfaces to refract.
 *
 * Adds a gentle mouse parallax: the whole field lags the cursor by a few px, nudged via the
 * --aurora-mx/--aurora-my CSS vars. Disabled for touch (no cursor) and reduced-motion. rAF-
 * throttled and passive so it never costs input latency.
 */
export function Aurora() {
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia?.('(pointer: fine)').matches;
    if (reduce || !fine) return undefined;

    let raf = 0;
    let tx = 0;
    let ty = 0;
    const onMove = (e) => {
      // Map cursor to a small ±12px offset from center; the aurora drifts opposite for depth.
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      tx = -nx * 24;
      ty = -ny * 24;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        document.documentElement.style.setProperty('--aurora-mx', `${tx.toFixed(1)}px`);
        document.documentElement.style.setProperty('--aurora-my', `${ty.toFixed(1)}px`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (raf) cancelAnimationFrame(raf);
      document.documentElement.style.removeProperty('--aurora-mx');
      document.documentElement.style.removeProperty('--aurora-my');
    };
  }, []);

  return (
    <>
      <div className="aurora" aria-hidden="true" />
      <div className="aurora-grain" aria-hidden="true" />
    </>
  );
}
