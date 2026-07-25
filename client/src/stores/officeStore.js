/**
 * Super-admin-only office switcher. Everyone else (regular users, site-admins) never calls
 * selectOffice(), so endpoints.js's loc() and time.js's resolveTz() transparently fall back to
 * the logged-in user's own home office — zero behavior change for non-super-admins.
 */
import { create } from 'zustand';
import { officeApi } from '@/services/endpoints.js';

export const useOfficeStore = create((set, get) => ({
  allOffices: [], // [{ id, name, timezone, address, active, userCount, chargerCount }]
  loaded: false,
  selectedOfficeId: null,

  loadOffices: async () => {
    const offices = await officeApi.listForAdmin();
    set({ allOffices: offices, loaded: true });
  },
  selectOffice: (officeId) => set({ selectedOfficeId: officeId }),
  clearSelection: () => set({ selectedOfficeId: null }),
  tzFor: (officeId) => get().allOffices.find((o) => o.id === officeId)?.timezone,
  // Full reset on auth transitions: this is a module-level singleton, so without clearing it on
  // logout/login a super-admin's selected office (and the roster) would leak into the NEXT user's
  // session on the same tab — routing every scoped call to /locations/<other-office>/... and 403ing
  // the whole app for a regular user. Called from authStore on logout and before each login.
  reset: () => set({ allOffices: [], loaded: false, selectedOfficeId: null }),
}));
