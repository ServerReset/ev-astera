import { useCallback, useMemo, useState } from 'react';
import { ShieldCheck, LayoutDashboard, Zap, Users, SlidersHorizontal, Megaphone, Car, ScrollText, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Tabs } from '@/components/common/Tabs.jsx';
import { OfficeSwitcher } from '@/components/admin/OfficeSwitcher.jsx';
import { OverviewTab } from '@/components/admin/OverviewTab.jsx';
import { ChargersTab } from '@/components/admin/ChargersTab.jsx';
import { UsersTab } from '@/components/admin/UsersTab.jsx';
import { SettingsTab } from '@/components/admin/SettingsTab.jsx';
import { AnnouncementsTab } from '@/components/admin/AnnouncementsTab.jsx';
import { CarpoolTab } from '@/components/admin/CarpoolTab.jsx';
import { AuditTab } from '@/components/admin/AuditTab.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useRealtime } from '@/hooks/useRealtime.js';
import { useOfficeStore } from '@/stores/officeStore.js';
import { adminApi, chargerApi } from '@/services/endpoints.js';

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'chargers', label: 'Chargers', icon: Zap },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'settings', label: 'Settings', icon: SlidersHorizontal },
  { key: 'announcements', label: 'Announcements', icon: Megaphone },
  { key: 'carpool', label: 'Carpool', icon: Car },
  { key: 'audit', label: 'Audit', icon: ScrollText },
];

/**
 * The admin console. A Tabs shell over seven surfaces. Super-admins get an office switcher whose
 * selection re-scopes every API call (endpoints.js's loc()); we key the page-level fetches on the
 * selected office so switching offices reloads the data for the newly-selected one.
 */
export default function AdminPage() {
  const [tab, setTab] = useState('overview');
  const selectedOfficeId = useOfficeStore((s) => s.selectedOfficeId);

  // Page-level data used by the lighter tabs; the heavier tabs (Users, Carpool, Audit) fetch
  // their own paginated data internally. Re-fetch when the office selection changes.
  const overview = useApi(() => adminApi.overview(), [selectedOfficeId]);
  const chargers = useApi(() => chargerApi.list(), [selectedOfficeId]);
  const settings = useApi(() => adminApi.getSettings(), [selectedOfficeId]);
  const announcements = useApi(() => adminApi.listAnnouncements(), [selectedOfficeId]);

  const refreshLive = useCallback(() => {
    overview.refetch();
    chargers.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useRealtime('admin', ['chargers', 'sessions', 'queue_entries'], refreshLive);

  // Remount data-bearing tab subtrees when the office changes so no stale local draft/state leaks.
  const scopeKey = selectedOfficeId || 'home';

  const refreshForTab = () => {
    if (tab === 'overview') overview.refetch();
    else if (tab === 'chargers') chargers.refetch();
    else if (tab === 'settings') settings.refetch();
    else if (tab === 'announcements') announcements.refetch();
  };

  return (
    <div>
      <PageHeader
        title="Admin console"
        description="Operate your site: chargers, members, settings, and carpool."
        icon={ShieldCheck}
        action={
          <div className="flex items-center gap-2">
            <OfficeSwitcher />
            <Button variant="ghost" size="sm" onClick={refreshForTab} aria-label="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <div key={`${scopeKey}-${tab}`} className="animate-fade-in">
        {tab === 'overview' && <OverviewTab overview={overview} />}
        {tab === 'chargers' && <ChargersTab chargers={chargers} />}
        {tab === 'users' && <UsersTab />}
        {tab === 'settings' && <SettingsTab settings={settings} />}
        {tab === 'announcements' && <AnnouncementsTab announcements={announcements} />}
        {tab === 'carpool' && <CarpoolTab />}
        {tab === 'audit' && <AuditTab />}
      </div>
    </div>
  );
}
