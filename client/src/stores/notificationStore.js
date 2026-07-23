/**
 * Notification store: unread badge count + recent list. Kept in sync by (a) an initial
 * fetch, (b) periodic polling (see useNotificationSync/useRealtime), and (c) explicit
 * mark-read calls. The bell in the header reads `unread`.
 */
import { create } from 'zustand';
import { notificationApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';

export const useNotificationStore = create((set, get) => ({
  items: [],
  unread: 0,
  loading: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const [list, count] = await Promise.all([
        notificationApi.list(1),
        notificationApi.unreadCount(),
      ]);
      set({ items: list.items || list || [], unread: count?.count ?? count ?? 0, loading: false });
    } catch (err) {
      set({ loading: false, error: normalizeError(err) });
    }
  },

  markRead: async (id) => {
    set((s) => ({
      items: s.items.map((n) => (n.id === id ? { ...n, readAt: n.readAt || new Date().toISOString() } : n)),
      unread: Math.max(0, s.unread - 1),
    }));
    try {
      await notificationApi.markRead(id);
    } catch {
      get().refresh();
    }
  },

  markAllRead: async () => {
    set((s) => ({ items: s.items.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })), unread: 0 }));
    try {
      await notificationApi.markAllRead();
    } catch {
      get().refresh();
    }
  },
}));
