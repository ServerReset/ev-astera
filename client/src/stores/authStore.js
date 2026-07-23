/**
 * Auth store. The access token lives in memory (in the axios module); this store holds the
 * user object + status and orchestrates login/register/logout/bootstrap. On app start we
 * attempt a silent refresh (the httpOnly cookie may still be valid) to restore the session.
 */
import { create } from 'zustand';
import { authApi, userApi } from '@/services/endpoints.js';
import { api, setAccessToken, setAuthClearedHandler, normalizeError } from '@/services/api.js';
import { ROLES } from '@/utils/constants.js';

export const useAuthStore = create((set, get) => ({
  user: null,
  status: 'idle', // 'idle' | 'loading' | 'authenticated' | 'unauthenticated'
  error: null,

  isAdmin: () => get().user?.role === ROLES.ADMIN,

  /** Called once on mount: try to restore a session via the refresh cookie. */
  bootstrap: async () => {
    set({ status: 'loading' });
    try {
      const { accessToken, user } = await api.post('/auth/refresh', {});
      setAccessToken(accessToken);
      // The refresh payload includes a lightweight user; fetch the full profile.
      let full = user;
      try {
        full = await userApi.me();
      } catch {
        /* fall back to refresh user */
      }
      set({ user: full, status: 'authenticated', error: null });
    } catch {
      setAccessToken(null);
      set({ user: null, status: 'unauthenticated' });
    }
  },

  login: async (credentials) => {
    set({ error: null });
    try {
      const { user, accessToken } = await authApi.login(credentials);
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
    set({ user: null, status: 'unauthenticated' });
  },

  /** Merge a fresh user object (e.g. after profile edit or credits change). */
  setUser: (user) => set({ user }),
  patchUser: (patch) => set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
}));

// When a token refresh fails mid-session, force the store back to unauthenticated.
setAuthClearedHandler(() => {
  useAuthStore.setState({ user: null, status: 'unauthenticated' });
});
