/**
 * Fetches the admin-configured session-duration ceiling once on mount, so the duration
 * slider/pre-check never desyncs from what session.service.js's start()/updateEta() actually
 * enforce (see shared/validation.js's durationMinutesSchema comment for the bug this fixes).
 * Returns null until loaded — callers should fall back to a sane default in the meantime.
 */
import { useEffect, useState } from 'react';
import { sessionApi } from '@/services/endpoints.js';

export function useSessionConfig() {
  const [maxSessionMinutes, setMaxSessionMinutes] = useState(null);

  useEffect(() => {
    let cancelled = false;
    sessionApi
      .getConfig()
      .then((cfg) => {
        if (!cancelled) setMaxSessionMinutes(cfg?.maxSessionMinutes || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return maxSessionMinutes;
}
