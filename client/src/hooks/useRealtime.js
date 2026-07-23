/**
 * useRealtime — polls on a fixed interval and calls `onChange()`. Same call signature as the
 * old Supabase-Realtime-backed version (channelName/tables kept for readability at call sites,
 * `filter` is unused now since every read already goes through the auth/location-scoped API).
 * ~20s cadence trades instant pushes for zero extra infrastructure (no Realtime, no WebSockets).
 */
import { useEffect, useRef } from 'react';

const POLL_MS = 20_000;

export function useRealtime(_channelName, _tables, onChange, { enabled = true } = {}) {
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!enabled) return undefined;
    const id = setInterval(() => cb.current?.(), POLL_MS);
    return () => clearInterval(id);
  }, [enabled]);
}
