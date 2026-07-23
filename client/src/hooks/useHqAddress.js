/**
 * Fetches the admin-configured Astera HQ address once on mount, for "From work" auto-fill.
 * Returns '' until loaded or if unset — callers should treat that as "don't auto-fill".
 */
import { useEffect, useState } from 'react';
import { carpoolApi } from '@/services/endpoints.js';

export function useHqAddress() {
  const [hqAddress, setHqAddress] = useState('');

  useEffect(() => {
    let cancelled = false;
    carpoolApi
      .getConfig()
      .then((cfg) => {
        if (!cancelled) setHqAddress(cfg?.hqAddress || '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return hqAddress;
}
