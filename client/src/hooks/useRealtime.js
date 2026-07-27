/**
 * useRealtime — polls on an interval and calls `onChange()`, but ONLY while the tab is visible.
 * Same call signature as the old Supabase-Realtime-backed version (channelName/tables kept for
 * readability at call sites; `filter` is unused now since every read goes through the auth/
 * location-scoped API).
 *
 * Efficiency (this app runs on a query-metered Postgres): the poll is gated on document visibility
 * — a backgrounded or idle tab does NOT poll at all (that idle-tab traffic was the dominant driver
 * of wasted queries). When the tab becomes visible again we fire one immediate refresh (classic
 * refetch-on-focus), so the user always sees fresh data the moment they look, without paying for
 * polls nobody is watching. Interval is 60s (was 20s) with a little jitter so many open tabs don't
 * stampede the server on the same tick.
 */
import { useEffect, useRef } from 'react';

const POLL_MS = 60_000;
const JITTER_MS = 10_000; // spread ticks across a 60–70s window

export function useRealtime(_channelName, _tables, onChange, { enabled = true } = {}) {
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    if (!enabled) return undefined;
    if (typeof document === 'undefined') return undefined;

    let timer = null;

    const stop = () => {
      if (timer) { clearTimeout(timer); timer = null; }
    };

    // Self-rescheduling timeout (not setInterval) so we can vary the delay with jitter and never
    // stack ticks. Only ever runs while the tab is visible.
    const scheduleNext = () => {
      stop();
      timer = setTimeout(tick, POLL_MS + Math.random() * JITTER_MS);
    };

    const tick = () => {
      // Guard again at fire time: a tab can hide between scheduling and firing.
      if (document.hidden) { stop(); return; }
      cb.current?.();
      scheduleNext();
    };

    const onVisibility = () => {
      if (document.hidden) {
        stop(); // backgrounded → stop burning queries entirely
      } else {
        // Became visible: refresh immediately (refetch-on-focus), then resume polling.
        cb.current?.();
        scheduleNext();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    // Start polling only if we're currently visible; if hidden, we wait for the visibility event.
    if (!document.hidden) scheduleNext();

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);
}
