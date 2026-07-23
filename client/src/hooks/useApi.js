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

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refetch = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current(...args);
      if (mounted.current) setData(result);
      return result;
    } catch (err) {
      const e = normalizeError(err);
      if (mounted.current) setError(e);
      throw e;
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (immediate) refetch().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, refetch, setData };
}
