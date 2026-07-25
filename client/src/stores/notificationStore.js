/**
 * Notification store: unread badge count + recent list. Kept in sync by (a) an initial
 * fetch, (b) periodic polling (see useNotificationSync/useRealtime), and (c) explicit
 * mark-read calls. The bell in the header reads `unread`.
 */
import { create } from 'zustand';
import { notificationApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';

// Monotonic call id (mirrors useApi.js's guard): two overlapping refresh() calls — the 20s
// poll racing a manual refresh, or two mounted pollers (AppLayout + NotificationsPage) —
// must not let an earlier, slower response overwrite state a later one already applied. Also
// guards markRead/markAllRead's optimistic writes against being clobbered by a refresh that
// was already in flight when the user clicked.
let callId = 0;

export const useNotificationStore = create((set, get) => ({
  items: [],
  unread: 0,
  loading: false,
  error: null,

  refresh: async () => {
    const id = ++callId;
    set({ loading: true, error: null });
    try {
      const [list, count] = await Promise.all([
        notificationApi.list(1),
        notificationApi.unreadCount(),
      ]);
      if (id !== callId) return; // superseded by a later refresh/mark-read — discard
      set({ items: list.items || list || [], unread: count?.count ?? count ?? 0, loading: false });
    } catch (err) {
      if (id !== callId) return;
      set({ loading: false, error: normalizeError(err) });
    }
  },

  markRead: async (notificationId) => {
    // Bump callId first: supersedes any refresh() already in flight so its (now-stale)
    // response can't land after this optimistic write and revert it — see refresh() above.
    callId += 1;
    set((s) => ({
      items: s.items.map((n) => (n.id === notificationId ? { ...n, readAt: n.readAt || new Date().toISOString() } : n)),
      unread: Math.max(0, s.unread - 1),
    }));
    try {
      await notificationApi.markRead(notificationId);
    } catch {
      get().refresh();
    }
  },

  markAllRead: async () => {
    callId += 1;
    set((s) => ({ items: s.items.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })), unread: 0 }));
    try {
      await notificationApi.markAllRead();
    } catch {
      get().refresh();
    }
  },

  // Clear all notification state on auth transitions. This is a module-level singleton whose
  // items/unread persist across an SPA logout→login (no page reload), so without this the prior
  // user's notifications and unread count would briefly render under the next user's session.
  // Bump callId so any refresh() already in flight can't repopulate stale data after the reset.
  reset: () => {
    callId += 1;
    set({ items: [], unread: 0, loading: false, error: null });
  },
}));
