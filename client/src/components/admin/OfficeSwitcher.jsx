import { useEffect } from 'react';
import { Building2 } from 'lucide-react';
import { Select } from '@/components/common/Input.jsx';
import { useOfficeStore } from '@/stores/officeStore.js';
import { useAuthStore } from '@/stores/authStore.js';

/**
 * Super-admin office switcher. Regular site-admins never see this — they operate on their own
 * office implicitly (endpoints.js's loc() falls back to their home office). Selecting an office
 * sets officeStore.selectedOfficeId, which re-scopes every L()-prefixed API call.
 */
export function OfficeSwitcher({ onChange }) {
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin());
  const { allOffices, loaded, selectedOfficeId, loadOffices, selectOffice } = useOfficeStore();
  const homeLocation = useAuthStore((s) => s.user?.locationId);

  useEffect(() => {
    if (isSuperAdmin && !loaded) loadOffices().catch(() => {});
  }, [isSuperAdmin, loaded, loadOffices]);

  // Default the selection to the super-admin's own office once the roster loads.
  useEffect(() => {
    if (isSuperAdmin && loaded && !selectedOfficeId && homeLocation) selectOffice(homeLocation);
  }, [isSuperAdmin, loaded, selectedOfficeId, homeLocation, selectOffice]);

  if (!isSuperAdmin) return null;

  const current = selectedOfficeId || homeLocation || '';
  const options = allOffices.map((o) => ({
    value: o.id,
    label: o.active ? o.name : `${o.name} (inactive)`,
  }));

  const handle = (e) => {
    selectOffice(e.target.value);
    onChange?.(e.target.value);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand/12 text-brand-strong">
        <Building2 className="h-4 w-4" />
      </span>
      <div className="w-56">
        <Select value={current} options={options} onChange={handle} aria-label="Select office" />
      </div>
    </div>
  );
}
