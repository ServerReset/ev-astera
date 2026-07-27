/**
 * Auth store. The access token lives in memory (in the axios module); this store holds the
 * user object + status and orchestrates login/register/logout/bootstrap. On app start we
 * attempt a silent refresh (the httpOnly cookie may still be valid) to restore the session.
 */
import { create } from 'zustand';
import { authApi } from '@/services/endpoints.js';
import { api, setAccessToken, setAuthClearedHandler, normalizeError } from '@/services/api.js';
import { useOfficeStore } from '@/stores/officeStore.js';
import { useNotificationStore } from '@/stores/notificationStore.js';
import { ADMIN_ROLES, ROLES } from '@/utils/constants.js';

// Clear every store scoped to a single user's session. Called on logout and before each login/
// register so a module-level singleton (office selection, notifications) can never carry from one
// user to the next on the same tab — this is an SPA, so logout/login don't reload the page.
function resetSessionScopedStores() {
  useOfficeStore.getState().reset();
  useNotificationStore.getState().reset();
}

export const useAuthStore = create((set, get) => ({
  user: null,
  status: 'idle', // 'idle' | 'loading' | 'authenticated' | 'unauthenticated'
  error: null,

  isAdmin: () => ADMIN_ROLES.includes(get().user?.role),
  isSuperAdmin: () => get().user?.role === ROLES.SUPER_ADMIN,

  /** Called once on mount: try to restore a session via the refresh cookie. */
  bootstrap: async () => {
    set({ status: 'loading' });
    try {
      // /auth/refresh returns the COMPLETE public user (same shape as /users/me, incl. createdAt),
      // so there's no second /users/me round-trip here — that was a redundant users read (with a
      // locations join) on every app load / tab open / hard reload. Pages that need live profile
      // data can refetch it themselves.
      const { accessToken, user } = await api.post('/auth/refresh', {});
      setAccessToken(accessToken);
      set({ user, status: 'authenticated', error: null });
    } catch {
      setAccessToken(null);
      set({ user: null, status: 'unauthenticated' });
    }
  },

  login: async (credentials) => {
    set({ error: null });
    try {
      const { user, accessToken } = await authApi.login(credentials);
      resetSessionScopedStores(); // drop any prior user's office/notification state
      setAccessToken(accessToken);
      set({ user, status: 'authenticated' });
      return { ok: true };
    } catch (err) {
      const e = normalizeError(err);
      set({ error: e.message });
      return { ok: false, error: e };
    }
  },

  register: async (payload) => {
    set({ error: null });
    try {
      const { user, accessToken } = await authApi.register(payload);
      resetSessionScopedStores();
      setAccessToken(accessToken);
      set({ user, status: 'authenticated' });
      return { ok: true };
    } catch (err) {
      const e = normalizeError(err);
      set({ error: e.message });
      return { ok: false, error: e };
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      /* best-effort */
    }
    setAccessToken(null);
    resetSessionScopedStores();
    set({ user: null, status: 'unauthenticated' });
  },

  /** Merge a fresh user object (e.g. after profile edit or credits change). */
  setUser: (user) => set({ user }),
  patchUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
}));

// When a token refresh fails mid-session, force the store back to unauthenticated.
setAuthClearedHandler(() => {
  resetSessionScopedStores();
  useAuthStore.setState({ user: null, status: 'unauthenticated' });
});
