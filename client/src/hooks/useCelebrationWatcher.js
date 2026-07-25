/**
 * useCelebrationWatcher — watches the notification store for genuinely-NEW celebratory
 * notifications (achievement unlocks, carpool matches) and surfaces the freshest one for a
 * full-screen reveal. Mounted once by AppLayout via <CelebrationOverlay>.
 *
 * The notification store has no new-item diffing of its own (refresh() just overwrites `items`),
 * so this hook keeps its own `seen` Set of notification ids. It SEEDS that set from the first
 * CLEANLY-COMPLETED load, so everything already in the inbox at startup is treated as "old".
 *
 * Seeding is the subtle part: the store's initial state is `loading:false, items:[]` BEFORE its
 * first fetch is even kicked off (useNotificationSync fires refresh() in an effect). Seeding on
 * that pre-fetch empty render would then treat the entire real backlog as brand-new the moment it
 * arrives and replay every past achievement. So we only seed after observing a real load settle:
 * loading went true (a fetch started) → false with no error. Ids appearing after that fire.
 */
import { useEffect, useRef, useState } from 'react';
import { useNotificationStore } from '@/stores/notificationStore.js';
import { NOTIFICATION_TYPES } from '@/utils/constants.js';

const CELEBRATION_TYPES = {
  [NOTIFICATION_TYPES.ACHIEVEMENT_UNLOCKED]: 'achievement',
  [NOTIFICATION_TYPES.CARPOOL_MATCH]: 'match',
};

export function useCelebrationWatcher() {
  const items = useNotificationStore((s) => s.items);
  const loading = useNotificationStore((s) => s.loading);
  const error = useNotificationStore((s) => s.error);
  const sawLoad = useRef(false); // has a fetch actually started (loading observed true)?
  const seeded = useRef(false);
  const seen = useRef(new Set());
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    if (loading) {
      sawLoad.current = true;
      return;
    }
    // Only seed after a real fetch has both started and settled cleanly — never on the
    // pre-fetch empty render, and not on an errored settle (wait for a good one).
    if (!seeded.current) {
      if (sawLoad.current && !error) {
        seen.current = new Set(items.map((n) => n.id));
        seeded.current = true;
      }
      return;
    }

    const fresh = [];
    for (const n of items) {
      if (seen.current.has(n.id)) continue;
      seen.current.add(n.id);
      const kind = CELEBRATION_TYPES[n.type];
      if (kind) fresh.push({ id: n.id, kind, notification: n });
    }
    // Newest notifications arrive first in the list; reverse so the queue plays oldest→newest.
    if (fresh.length) setQueue((q) => [...q, ...fresh.reverse()]);
  }, [items, loading, error]);

  const dismiss = () => setQueue((q) => q.slice(1));

  return { celebration: queue[0] || null, dismiss };
}
