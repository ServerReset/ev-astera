/**
 * Fetches the admin-configured nudge presets + emergency reasons once on mount, so
 * NudgeModal/EmergencyModal never fall back to a stale hardcoded list — an admin can
 * add/remove/reword either list from Settings without a client deploy.
 * Returns null lists until loaded — callers should render nothing/a skeleton meanwhile.
 */
import { useEffect, useState } from 'react';
import { messageApi } from '@/services/endpoints.js';

export function useMessageConfig() {
  const [config, setConfig] = useState({ loading: true, nudgePresets: null, emergencyReasons: null });

  useEffect(() => {
    let cancelled = false;
    messageApi
      .getConfig()
      .then((cfg) => {
        if (!cancelled) {
          setConfig({ loading: false, nudgePresets: cfg?.nudgePresets || [], emergencyReasons: cfg?.emergencyReasons || [] });
        }
      })
      .catch(() => {
        if (!cancelled) setConfig({ loading: false, nudgePresets: [], emergencyReasons: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return config;
}
