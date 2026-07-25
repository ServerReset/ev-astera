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
}));
