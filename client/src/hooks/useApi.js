/**
 * useApi — a tiny data-fetching hook: runs an async fn on mount (and when `deps` change),
 * exposes { data, error, loading, refetch, setData }. Not a cache; for this app's scale a
 * per-view fetch + realtime invalidation is simpler and sufficient than a query library.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeError } from '@/services/api.js';

export function useApi(fn, deps = [], { immediate = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const mounted = useRef(true);
  // Monotonic call id: guards against out-of-order resolution. When `deps` change fires
  // refetch twice, an earlier (slower) request must not overwrite state with stale data
  // after a later one has already landed. Only the most-recent call's result is applied.
  const callId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refetch = useCallback(async (...args) => {
    const id = ++callId.current;
    const isCurrent = () => mounted.current && id === callId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current(...args);
      if (isCurrent()) setData(result);
      return result;
    } catch (err) {
      const e = normalizeError(err);
      if (isCurrent()) setError(e);
      throw e;
    } finally {
      if (isCurrent()) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (immediate) refetch().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, refetch, setData };
}
