/**
 * useNotificationSync — mounted once by AppLayout. Loads the initial notification state and
 * polls so the header badge stays reasonably fresh without a persistent connection.
 */
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore.js';
import { useNotificationStore } from '@/stores/notificationStore.js';
import { useRealtime } from './useRealtime.js';

export function useNotificationSync() {
  const userId = useAuthStore((s) => s.user?.id);
  const refresh = useNotificationStore((s) => s.refresh);

  useEffect(() => {
    if (userId) refresh();
  }, [userId, refresh]);

  useRealtime('notifications', 'notifications', refresh, { enabled: Boolean(userId) });
}
