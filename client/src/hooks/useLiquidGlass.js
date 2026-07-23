import { useEffect, useRef } from 'react';
import { liquidGlass } from '@/utils/liquidGlass.js';

/**
 * Applies the liquid-glass refraction effect to the returned ref's element while `active` is
 * true, and tears it down when `active` goes false or the component unmounts. `active` should
 * track whatever condition mounts the glass surface (e.g. a modal's `open` prop) — pass `true`
 * for surfaces that are always present once mounted (e.g. a toast).
 */
export function useLiquidGlass(active = true, opts) {
  const ref = useRef(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!active || !ref.current) return undefined;
    const glass = liquidGlass(ref.current, optsRef.current);
    return () => glass.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return ref;
}
