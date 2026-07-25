import { useEffect, useState } from 'react';
import {
  ShieldCheck, Activity, Zap, Settings as SettingsIcon, Megaphone, Users as UsersIcon, ScrollText,
  Plus, Trash2, Power, PowerOff, StopCircle, Search, Car, Leaf, Pencil, CalendarClock, UserSquare2,
  KeyRound, Copy, Check,
} from 'lucide-react';
import { announcementSchema, adminCreateUserSchema, chargerNameSchema } from '@shared/validation.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Tabs } from '@/components/common/Tabs.jsx';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Modal } from '@/components/common/Modal.jsx';
import { Input, Textarea, Select } from '@/components/common/Input.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { Switch } from '@/components/common/Switch.jsx';
import { EmptyState, ErrorState } from '@/components/common/States.jsx';
import { useConfirm } from '@/components/common/ConfirmDialog.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useLiquidGlass } from '@/hooks/useLiquidGlass.js';
import { useRealtime } from '@/hooks/useRealtime.js';
import { adminApi, chargerApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { useAuthStore } from '@/stores/authStore.js';
import { useOfficeStore } from '@/stores/officeStore.js';
import { formatDateTime } from '@/utils/time.js';
import { cn } from '@/utils/cn.js';
import { CHARGER_STATUS_META, SETTING_KEYS, ROLES, NOTIFICATION_TEMPLATES, notifTplSettingKey } from '@/utils/constants.js';

const ROLE_LABEL = { user: 'User', site_admin: 'Site admin', super_admin: 'Super admin' };

// Admin is a console: a segmented section switcher on compact/medium collapses to a persistent
// section rail at xl, matching the app's own nav-changes-by-breakpoint pattern (bottom bar →
// rail → drawer). The rail is gated at xl, not expanded, for the same reason as Dashboard/
// Settings — the 288px permanent app drawer already claims width, so a second column of nav
// only has room once the viewport is genuinely laptop-wide.
const SECTIONS = [
  { key: 'overview', label: 'Overview', icon: Activity },
  { key: 'chargers', label: 'Chargers', icon: Zap },
  { key: 'carpool', label: 'Carpool', icon: Car },
  { key: 'general', label: 'General', icon: SettingsIcon },
  { key: 'announce', label: 'Announcements', icon: Megaphone },
  { key: 'users', label: 'Users', icon: UsersIcon },
  { key: 'audit', label: 'Activity', icon: ScrollText },
];

// Shared entry-motion helpers, consistent with the rest of the rebuild. Cards slide up; table
// rows only fade (a translateY transform on <tr> renders inconsistently across engines).
const ENTER = 'animate-slide-up [animation-fill-mode:backwards]';
const ROW_ENTER = 'animate-fade-in [animation-fill-mode:backwards]';
const stagger = (i) => ({ animationDelay: `${Math.min(i, 8) * 40}ms` });

// Tonal accent chips for the overview tiles — token-only, never raw color.
const TONE_CHIP = {
  brand: 'bg-brand/15 text-brand-strong',
  info: 'bg-info/15 text-info',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
};

// Shared dense-table cell paddings so every admin table reads uniformly.
const TH = 'px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted';
const TD = 'px-4 py-3 align-middle';

export default function AdminPage() {
  const [section, setSection] = useState('overview');
  const viewerRole = useAuthStore((s) => s.user?.role);
  const isSuperAdmin = viewerRole === ROLES.SUPER_ADMIN;

  const allOffices = useOfficeStore((s) => s.allOffices);
  const loaded = useOfficeStore((s) => s.loaded);
  const selectedOfficeId = useOfficeStore((s) => s.selectedOfficeId);
  const loadOffices = useOfficeStore((s) => s.loadOffices);
  const selectOffice = useOfficeStore((s) => s.selectOffice);
  const clearSelection = useOfficeStore((s) => s.clearSelection);

  useEffect(() => {
    if (isSuperAdmin && !loaded) loadOffices().catch(() => {});
  }, [isSuperAdmin, loaded, loadOffices]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Admin" description="Operational controls and configuration for your site." icon={ShieldCheck} />

      {isSuperAdmin && allOffices.length > 0 && (
        <div className="mb-5 max-w-xs">
          <Select
            label="Viewing office"
            value={selectedOfficeId || ''}
            onChange={(e) => (e.target.value ? selectOffice(e.target.value) : clearSelection())}
            options={[{ value: '', label: 'My office' }, ...allOffices.map((o) => ({ value: o.id, label: o.name }))]}
          />
        </div>
      )}

      {/* Compact / medium: segmented section switcher. Hidden once the rail takes over at xl. */}
      <div className="xl:hidden">
        <Tabs tabs={SECTIONS} value={section} onChange={setSection} />
      </div>

      <div className="xl:grid xl:grid-cols-[248px_1fr] xl:gap-6">
        {/* Persistent section rail — MD3 secondary navigation, large windows only. */}
        <nav aria-label="Admin sections" className="hidden xl:block">
          <div className="sticky top-6 space-y-1">
            {SECTIONS.map((s) => {
              const active = s.key === section;
              const SectionIcon = s.icon;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-left text-sm font-medium',
                    'transition-[background-color,color] duration-medium ease-emphasized',
                    active ? 'bg-brand/15 text-brand-strong' : 'text-muted hover:bg-surface-2 hover:text-content'
                  )}
                >
                  <SectionIcon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{s.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Detail panel — re-keyed on section AND selected office so switching either one
            remounts the subtree, which makes every child's mount-time fetch naturally re-run
            against whichever office loc() now resolves to. */}
        <div key={`${section}:${selectedOfficeId || 'home'}`} className="animate-fade-in">
          {section === 'overview' && <OverviewTab />}
          {section === 'chargers' && <ChargersTab />}
          {section === 'carpool' && <CarpoolTab />}
          {section === 'general' && <GeneralTab />}
          {section === 'announce' && <AnnouncementsTab />}
          {section === 'users' && <UsersTab />}
          {section === 'audit' && <AuditTab />}
        </div>
      </div>
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────────
function OverviewTab() {
  const overview = useApi(() => adminApi.overview(), []);
  useRealtime('admin-overview', ['sessions', 'queue_entries', 'carpool_rides'], overview.refetch);

  if (overview.loading && !overview.data) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-[120px] rounded-2xl" />
        ))}
      </div>
    );
  }
  if (overview.error) return <ErrorState error={overview.error} onRetry={overview.refetch} title="Could not load the dashboard overview" />;

  const o = overview.data || {};
  const tiles = [
    { label: 'Active sessions', value: o.activeSessions, icon: Zap, tone: 'brand' },
    { label: 'Waiting in queue', value: o.queueWaiting, icon: UsersIcon, tone: 'warning' },
    { label: 'Active users', value: o.activeUsers, icon: UsersIcon, tone: 'info' },
    { label: 'Sessions (24h)', value: o.sessionsLast24h, icon: Activity, tone: 'brand' },
    { label: 'Open carpool rides', value: o.carpoolOpenRides, icon: Car, tone: 'info' },
    { label: 'CO₂ saved this week', value: `${o.carpoolCo2KgThisWeek ?? 0} kg`, icon: Leaf, tone: 'success' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((t, i) => (
        <Card key={t.label} className={ENTER} style={stagger(i)}>
          <span className={cn('mb-3 inline-grid h-10 w-10 place-items-center rounded-2xl', TONE_CHIP[t.tone])}>
            <t.icon className="h-5 w-5" />
          </span>
          <p className="text-3xl font-bold text-content tabular-nums">{t.value ?? 0}</p>
          <p className="mt-0.5 text-sm text-muted">{t.label}</p>
        </Card>
      ))}
    </div>
  );
}

// ── Chargers ─────────────────────────────────────────────────────────────────────
// Kept as a responsive card grid (not a table): each charger carries a live status badge and
// context-dependent actions (force-end only when in use, online/offline toggle), which read far
// more clearly as cards than as cramped table rows.
function ChargersTab() {
  const chargers = useApi(() => chargerApi.list(), []);
  const [busyId, setBusyId] = useState(null);
  const [offlineFor, setOfflineFor] = useState(null);
  const [renameFor, setRenameFor] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  useRealtime('admin-chargers', ['chargers', 'sessions'], chargers.refetch);

  const online = async (c) => {
    setBusyId(c.id);
    try {
      await adminApi.setChargerOnline(c.id);
      toast.success(`${c.name} is back online.`);
      chargers.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const forceEnd = async (c) => {
    if (!c.session?.id) return;
    if (!(await confirm({ title: 'Force-end session?', message: `End ${c.session.userDisplayName || 'this user'}'s session on ${c.name}? They'll be notified.`, danger: true, confirmLabel: 'Force end' }))) return;
    setBusyId(c.id);
    try {
      await adminApi.forceEndSession(c.session.id);
      toast.success('Session ended.');
      chargers.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (c) => {
    if (!(await confirm({
      title: 'Delete charger?',
      message: `Delete ${c.name}? This permanently removes its session history, queue entries, and messages. This can't be undone.`,
      danger: true,
      confirmLabel: 'Delete',
    }))) return;
    setBusyId(c.id);
    try {
      await adminApi.deleteCharger(c.id);
      toast.success(`${c.name} deleted.`);
      chargers.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  if (chargers.loading && !chargers.data) {
    return (
      <div className="grid gap-3 expanded:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-[132px] rounded-2xl" />
        ))}
      </div>
    );
  }
  if (chargers.error) return <ErrorState error={chargers.error} onRetry={chargers.refetch} title="Could not load chargers" />;

  const list = chargers.data || [];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add charger
        </Button>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={Zap} title="No chargers configured" description="Add chargers to this site to start tracking sessions." />
      ) : (
        <div className="grid gap-3 expanded:grid-cols-2">
          {list.map((c, i) => {
            const meta = CHARGER_STATUS_META[c.status] || CHARGER_STATUS_META.available;
            return (
              <Card key={c.id} className={ENTER} style={stagger(i)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold text-content">
                      {c.name}
                      <Badge tone={meta.tone} dot>{meta.label}</Badge>
                    </p>
                    {c.session ? (
                      <p className="mt-1 text-sm text-muted">
                        In use by {c.session.userDisplayName || 'a user'} · ETA {c.session.etaAt ? formatDateTime(c.session.etaAt) : '—'}
                      </p>
                    ) : c.offlineReason ? (
                      <p className="mt-1 text-sm text-warning">Offline: {c.offlineReason}</p>
                    ) : (
                      <p className="mt-1 text-sm text-faint">No active session</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.session && (
                    <Button size="sm" variant="danger" onClick={() => forceEnd(c)} loading={busyId === c.id}>
                      <StopCircle className="h-4 w-4" />
                      Force end
                    </Button>
                  )}
                  {c.status === 'offline' ? (
                    <Button size="sm" variant="secondary" onClick={() => online(c)} loading={busyId === c.id}>
                      <Power className="h-4 w-4" />
                      Set online
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => setOfflineFor(c)}>
                      <PowerOff className="h-4 w-4" />
                      Set offline
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setRenameFor(c)}>
                    <Pencil className="h-4 w-4" />
                    Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    disabled={Boolean(c.session)}
                    loading={busyId === c.id}
                    onClick={() => remove(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <OfflineModal
        charger={offlineFor}
        onClose={() => setOfflineFor(null)}
        onDone={() => {
          setOfflineFor(null);
          chargers.refetch();
        }}
      />
      <ChargerNameModal
        open={addOpen}
        title="Add charger"
        confirmLabel="Add"
        onClose={() => setAddOpen(false)}
        onSubmit={(name) => adminApi.createCharger({ name })}
        onDone={() => {
          setAddOpen(false);
          chargers.refetch();
        }}
        successMessage={(name) => `${name} added.`}
      />
      <ChargerNameModal
        open={Boolean(renameFor)}
        title={`Rename ${renameFor?.name || 'charger'}`}
        confirmLabel="Rename"
        initialName={renameFor?.name}
        onClose={() => setRenameFor(null)}
        onSubmit={(name) => adminApi.renameCharger(renameFor.id, name)}
        onDone={() => {
          setRenameFor(null);
          chargers.refetch();
        }}
        successMessage={(name) => `Renamed to ${name}.`}
      />
      {confirmDialog}

      <div className="mt-6 space-y-5">
        <SettingsEditor groups={CHARGER_SETTING_GROUPS} />
        <NotificationTemplatesEditor group="chargers" />
      </div>
    </>
  );
}

function ChargerNameModal({ open, title, confirmLabel, initialName = '', onClose, onSubmit, onDone, successMessage }) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Re-seed the draft whenever the modal opens for a (possibly different) charger.
  useEffect(() => {
    if (open) {
      setName(initialName || '');
      setError(null);
    }
  }, [open, initialName]);

  const submit = async () => {
    const parsed = chargerNameSchema.safeParse({ name: name.trim() });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setSaving(true);
    try {
      await onSubmit(parsed.data.name);
      toast.success(successMessage(parsed.data.name));
      onDone();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>{confirmLabel}</Button>
        </div>
      }
    >
      <Input label="Charger name" value={name} onChange={(e) => setName(e.target.value)} error={error} placeholder="e.g. Charger 3" />
    </Modal>
  );
}

function OfflineModal({ charger, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      await adminApi.setChargerOffline(charger.id, reason.trim() || undefined);
      toast.success(`${charger.name} set offline.`);
      setReason('');
      onDone();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={Boolean(charger)}
      onClose={onClose}
      title={`Take ${charger?.name || 'charger'} offline`}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={submit} loading={saving}>Set offline</Button>
        </div>
      }
    >
      <Textarea label="Reason (optional)" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="Maintenance, out of order, etc." />
    </Modal>
  );
}

// ── Carpool ──────────────────────────────────────────────────────────────────────
// Location-wide visibility + force-cancel for rides/requests/schedules/groups. Regular users
// only see their own via the self-service carpool endpoints; these are the admin overrides
// (no ownership check) delegated through adminService → carpoolService.
const CARPOOL_SECTIONS = [
  { key: 'rides', label: 'Rides', icon: Car },
  { key: 'requests', label: 'Requests', icon: Search },
  { key: 'schedules', label: 'Schedules', icon: CalendarClock },
  { key: 'groups', label: 'Groups', icon: UserSquare2 },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
];

function CarpoolTab() {
  const [section, setSection] = useState('rides');
  return (
    <div>
      <Tabs tabs={CARPOOL_SECTIONS} value={section} onChange={setSection} />
      {section === 'rides' && <CarpoolRidesPanel />}
      {section === 'requests' && <CarpoolRequestsPanel />}
      {section === 'schedules' && <CarpoolSchedulesPanel />}
      {section === 'groups' && <CarpoolGroupsPanel />}
      {section === 'settings' && (
        <div className="space-y-5">
          <SettingsEditor groups={CARPOOL_SETTING_GROUPS} />
          <NotificationTemplatesEditor group="carpool" />
        </div>
      )}
    </div>
  );
}

function CarpoolRidesPanel() {
  const rides = useApi(() => adminApi.listCarpoolRides(), []);
  const [confirm, confirmDialog] = useConfirm();
  const [busyId, setBusyId] = useState(null);
  useRealtime('admin-carpool-rides', ['carpool_rides', 'carpool_bookings'], rides.refetch);

  const cancel = async (r) => {
    if (!(await confirm({
      title: 'Cancel this ride?',
      message: `Cancel ${r.driverName || 'this driver'}'s ride departing ${formatDateTime(r.departAt)}? Any riders booked will be notified.`,
      danger: true,
      confirmLabel: 'Cancel ride',
    }))) return;
    setBusyId(r.id);
    try {
      await adminApi.cancelCarpoolRide(r.id);
      toast.success('Ride cancelled.');
      rides.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  if (rides.loading && !rides.data) {
    return (
      <ul className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <li key={i} className="skeleton h-20 rounded-2xl" />)}
      </ul>
    );
  }
  if (rides.error) return <ErrorState error={rides.error} onRetry={rides.refetch} title="Could not load rides" />;

  const list = rides.data || [];
  if (list.length === 0) return <EmptyState icon={Car} title="No open rides" description="Rides drivers post will show up here." />;

  return (
    <>
      <ul className="space-y-2">
        {list.map((r, i) => (
          <Card key={r.id} as="li" className={cn('flex items-start justify-between gap-3', ENTER)} style={stagger(i)}>
            <div className="min-w-0">
              <p className="font-medium text-content">
                {r.driverName || 'A driver'} · {r.direction === 'to_site' ? 'To work' : 'From work'}
              </p>
              <p className="text-sm text-muted">{r.origin?.label}</p>
              <p className="text-xs text-faint">
                Departs {formatDateTime(r.departAt)} · {r.seatsAvailable}/{r.seatsTotal} seats free
              </p>
            </div>
            <Button size="sm" variant="ghost" className="shrink-0 text-danger" loading={busyId === r.id} onClick={() => cancel(r)}>
              <Trash2 className="h-4 w-4" />
              Cancel
            </Button>
          </Card>
        ))}
      </ul>
      {confirmDialog}
    </>
  );
}

function CarpoolRequestsPanel() {
  const requests = useApi(() => adminApi.listCarpoolRequests(), []);
  const [confirm, confirmDialog] = useConfirm();
  const [busyId, setBusyId] = useState(null);
  useRealtime('admin-carpool-requests', ['carpool_requests'], requests.refetch);

  const cancel = async (r) => {
    if (!(await confirm({ title: 'Cancel this request?', message: `Cancel ${r.riderName || 'this rider'}'s ride request?`, danger: true, confirmLabel: 'Cancel request' }))) return;
    setBusyId(r.id);
    try {
      await adminApi.cancelCarpoolRequest(r.id);
      toast.success('Request cancelled.');
      requests.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  if (requests.loading && !requests.data) {
    return (
      <ul className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <li key={i} className="skeleton h-20 rounded-2xl" />)}
      </ul>
    );
  }
  if (requests.error) return <ErrorState error={requests.error} onRetry={requests.refetch} title="Could not load ride requests" />;

  const list = requests.data || [];
  if (list.length === 0) return <EmptyState icon={Search} title="No open requests" description="Riders looking for a ride will show up here." />;

  return (
    <>
      <ul className="space-y-2">
        {list.map((r, i) => (
          <Card key={r.id} as="li" className={cn('flex items-start justify-between gap-3', ENTER)} style={stagger(i)}>
            <div className="min-w-0">
              <p className="font-medium text-content">
                {r.riderName || 'A rider'} · {r.direction === 'to_site' ? 'To work' : 'From work'}
              </p>
              <p className="text-sm text-muted">{r.origin?.label}</p>
              <p className="text-xs text-faint">
                {formatDateTime(r.windowStart)} – {formatDateTime(r.windowEnd)}
              </p>
            </div>
            <Button size="sm" variant="ghost" className="shrink-0 text-danger" loading={busyId === r.id} onClick={() => cancel(r)}>
              <Trash2 className="h-4 w-4" />
              Cancel
            </Button>
          </Card>
        ))}
      </ul>
      {confirmDialog}
    </>
  );
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function CarpoolSchedulesPanel() {
  const schedules = useApi(() => adminApi.listCarpoolSchedules(), []);
  const [confirm, confirmDialog] = useConfirm();
  const [busyId, setBusyId] = useState(null);

  const remove = async (s) => {
    if (!(await confirm({ title: 'Delete this recurring commute?', message: `Delete ${s.userName || 'this user'}'s recurring commute? This can't be undone.`, danger: true, confirmLabel: 'Delete' }))) return;
    setBusyId(s.id);
    try {
      await adminApi.deleteCarpoolSchedule(s.id);
      toast.success('Recurring commute deleted.');
      schedules.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  if (schedules.loading && !schedules.data) {
    return (
      <ul className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <li key={i} className="skeleton h-20 rounded-2xl" />)}
      </ul>
    );
  }
  if (schedules.error) return <ErrorState error={schedules.error} onRetry={schedules.refetch} title="Could not load recurring commutes" />;

  const list = schedules.data || [];
  if (list.length === 0) return <EmptyState icon={CalendarClock} title="No recurring commutes" description="Schedules users set up will show up here." />;

  return (
    <>
      <ul className="space-y-2">
        {list.map((s, i) => (
          <Card key={s.id} as="li" className={cn('flex items-start justify-between gap-3', ENTER)} style={stagger(i)}>
            <div className="min-w-0">
              <p className="flex items-center gap-2 font-medium text-content">
                {s.userName || 'A user'} · {s.direction === 'to_site' ? 'To work' : 'From work'}
                {!s.active && <Badge tone="faint">Inactive</Badge>}
              </p>
              <p className="text-sm text-muted">{s.origin?.label}</p>
              <p className="text-xs text-faint">
                {s.daysOfWeek?.map((d) => DAY_LABELS[d]).join(', ')} at {s.departTime}
              </p>
            </div>
            <Button size="sm" variant="ghost" className="shrink-0 text-danger" loading={busyId === s.id} onClick={() => remove(s)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </Card>
        ))}
      </ul>
      {confirmDialog}
    </>
  );
}

function CarpoolGroupsPanel() {
  const groups = useApi(() => adminApi.listCarpoolGroups(), []);
  const [confirm, confirmDialog] = useConfirm();
  const [busyId, setBusyId] = useState(null);

  const remove = async (g) => {
    if (!(await confirm({ title: 'Delete this group?', message: `Delete "${g.name}"? Its ${g.memberCount} member(s) will be removed from it. This can't be undone.`, danger: true, confirmLabel: 'Delete' }))) return;
    setBusyId(g.id);
    try {
      await adminApi.deleteCarpoolGroup(g.id);
      toast.success('Group deleted.');
      groups.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  if (groups.loading && !groups.data) {
    return (
      <ul className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => <li key={i} className="skeleton h-16 rounded-2xl" />)}
      </ul>
    );
  }
  if (groups.error) return <ErrorState error={groups.error} onRetry={groups.refetch} title="Could not load carpool groups" />;

  const list = groups.data || [];
  if (list.length === 0) return <EmptyState icon={UserSquare2} title="No carpool groups" description="Groups users create will show up here." />;

  return (
    <>
      <ul className="space-y-2">
        {list.map((g, i) => (
          <Card key={g.id} as="li" className={cn('flex items-start justify-between gap-3', ENTER)} style={stagger(i)}>
            <div className="min-w-0">
              <p className="font-medium text-content">{g.name}</p>
              {g.description && <p className="text-sm text-muted">{g.description}</p>}
              <p className="text-xs text-faint">{g.memberCount} member{g.memberCount === 1 ? '' : 's'}</p>
            </div>
            <Button size="sm" variant="ghost" className="shrink-0 text-danger" loading={busyId === g.id} onClick={() => remove(g)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </Card>
        ))}
      </ul>
      {confirmDialog}
    </>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────────
// Human labels + input types for each business-rule setting, grouped for the form and split
// by which admin tab they actually govern — Chargers/Carpool/General — instead of one flat
// "Settings" section. Reliability's queue-priority/lockout settings live with Chargers (that's
// their primary effect); the carpool driver bonus lives with Carpool.
const CHARGER_SETTING_GROUPS = [
  {
    title: 'Sessions & queue',
    fields: [
      // min: 0.5 matches durationMinutesSchema's hardcoded 30-minute floor (shared/validation.js)
      // — below that, StartSessionModal/EtaModal's slider has no valid duration to offer and
      // starting a session becomes impossible office-wide until an admin raises it back up.
      { key: SETTING_KEYS.MAX_SESSION_HOURS, label: 'Max session length (hours)', type: 'number', min: 0.5 },
      { key: SETTING_KEYS.MAX_WEEKLY_SESSIONS, label: 'Max sessions per week', type: 'number' },
      { key: SETTING_KEYS.GRACE_PERIOD_MINUTES, label: 'Queue grace period (min)', type: 'number' },
      { key: SETTING_KEYS.CLAIM_WINDOW_MINUTES, label: 'Claim window (min)', type: 'number' },
    ],
  },
  {
    title: 'Overtime & nudges',
    fields: [
      { key: SETTING_KEYS.OVERTIME_FIRST_NUDGE_MINUTES, label: 'First overtime nudge (min)', type: 'number' },
      { key: SETTING_KEYS.OVERTIME_ADMIN_ALERT_MINUTES, label: 'Admin alert after (min)', type: 'number' },
      { key: SETTING_KEYS.NUDGE_RATE_LIMIT_MINUTES, label: 'Nudge rate limit (min)', type: 'number' },
      { key: SETTING_KEYS.MAX_NUDGES_PER_SESSION, label: 'Max nudges per session', type: 'number' },
      { key: SETTING_KEYS.NUDGE_PRESETS, label: 'Quick-pick nudge messages', type: 'list' },
    ],
  },
  {
    title: 'Emergencies',
    fields: [
      { key: SETTING_KEYS.EMERGENCY_COOLDOWN_HOURS, label: 'Emergency cooldown (hours)', type: 'number' },
      { key: SETTING_KEYS.EMERGENCY_RESPONSE_WINDOW_MINUTES, label: 'Emergency response window (min)', type: 'number' },
      { key: SETTING_KEYS.EMERGENCY_REASONS, label: 'Emergency reasons', type: 'list' },
    ],
  },
  {
    title: 'Reliability score',
    fields: [
      { key: SETTING_KEYS.RELIABILITY_ENABLED, label: 'Enable reliability scoring', type: 'bool' },
      { key: SETTING_KEYS.RELIABILITY_BASELINE, label: 'Baseline score', type: 'number' },
      { key: SETTING_KEYS.RELIABILITY_OVERTIME_GRACE_MINUTES, label: 'Overtime grace period (min)', type: 'number' },
      { key: SETTING_KEYS.RELIABILITY_OVERTIME_PENALTY_PER_MINUTE, label: 'Overtime penalty per minute', type: 'number' },
      { key: SETTING_KEYS.RELIABILITY_OVERTIME_ESCALATION_FACTOR, label: 'Overtime penalty escalation factor', type: 'number' },
      { key: SETTING_KEYS.RELIABILITY_FAST_UNPLUG_BONUS, label: 'Fast unplug bonus', type: 'number' },
      { key: SETTING_KEYS.RELIABILITY_DECAY_PER_DAY, label: 'Passive decay toward baseline (points/day)', type: 'number' },
      { key: SETTING_KEYS.RELIABILITY_LOCKOUT_THRESHOLD, label: 'Lockout threshold score', type: 'number' },
      { key: SETTING_KEYS.RELIABILITY_LOCKOUT_DURATION_HOURS, label: 'Lockout duration (hours)', type: 'number' },
      { key: SETTING_KEYS.RELIABILITY_QUEUE_WEIGHT, label: 'Queue priority weight', type: 'number' },
      { key: SETTING_KEYS.QUEUE_MAX_AUTO_REQUEUES, label: 'Max automatic queue re-joins after a missed turn', type: 'number' },
    ],
  },
];

const CARPOOL_SETTING_GROUPS = [
  {
    title: 'Carpool',
    fields: [
      { key: SETTING_KEYS.CARPOOL_ENABLED, label: 'Carpool enabled', type: 'bool' },
      { key: SETTING_KEYS.CARPOOL_PRIORITY_ENABLED, label: 'Give carpool drivers queue priority', type: 'bool' },
      { key: SETTING_KEYS.CARPOOL_MIN_LEAD_MINUTES, label: 'Min ride lead time (min)', type: 'number' },
      { key: SETTING_KEYS.CARPOOL_DEFAULT_TRIP_MILES, label: 'Default trip miles (used when no distance is entered)', type: 'number' },
      { key: SETTING_KEYS.CARPOOL_MIN_MATCH_SCORE, label: 'Min match score (0–100)', type: 'number' },
      { key: SETTING_KEYS.CARPOOL_CO2_GRAMS_PER_MILE, label: 'CO₂ grams saved per mile', type: 'number' },
      { key: SETTING_KEYS.CARPOOL_CREDIT_PER_TRIP, label: 'Credits per trip (driver)', type: 'number' },
      { key: SETTING_KEYS.CARPOOL_CREDIT_PER_RIDER, label: 'Credits per rider', type: 'number' },
      { key: SETTING_KEYS.CARPOOL_HQ_ADDRESS, label: 'Astera HQ address (auto-fills "From work" rides)', type: 'text' },
      { key: SETTING_KEYS.RELIABILITY_CARPOOL_DRIVER_BONUS, label: 'Carpool driver reliability bonus (per trip)', type: 'number' },
    ],
  },
];

const GENERAL_SETTING_GROUPS = [
  {
    title: 'Registration',
    fields: [
      { key: SETTING_KEYS.SIGNUP_RELEASE_AT, label: 'Signups open at (ISO date/time, blank = open now)', type: 'text' },
      { key: SETTING_KEYS.SIGNUP_GEOFENCE_ENABLED, label: 'Require on-site location to sign up', type: 'bool' },
      { key: SETTING_KEYS.SIGNUP_GEOFENCE_RADIUS_METERS, label: 'Signup geofence radius (meters)', type: 'number' },
    ],
  },
];

function SettingsSkeleton() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card p-4">
          <div className="skeleton mb-4 h-5 w-44 rounded" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="skeleton h-[52px] rounded-2xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Reusable settings fetch/draft/validate/save editor, parameterized by which groups to render
 * — each admin tab mounts its own instance for just the settings it governs. Every mount does
 * its own independent fetch/save; concurrent saves from different tabs can't clobber each
 * other since configService.update() upserts per-key, not as one big blob. */
/** Array-of-strings editor for `type: 'list'` settings (e.g. nudge presets, emergency
 * reasons) — add/edit/remove rows freely, no fixed count. Blank rows are dropped on save
 * (SettingsEditor.save), not here, so a mid-edit blank row doesn't yank focus away. */
function ListSettingEditor({ label, value, onChange }) {
  const setItem = (i, v) => onChange(value.map((item, idx) => (idx === i ? v : item)));
  const removeItem = (i) => onChange(value.filter((_, idx) => idx !== i));
  const addItem = () => onChange([...value, '']);

  return (
    <div>
      <span className="label">{label}</span>
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input className="flex-1" value={item} onChange={(e) => setItem(i, e.target.value)} />
            <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(i)} aria-label="Remove">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={addItem}>
        <Plus className="h-4 w-4" />
        Add
      </Button>
    </div>
  );
}

function SettingsEditor({ groups }) {
  const settings = useApi(() => adminApi.getSettings(), []);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  // Initialize the editable draft from the fetched settings once.
  const values = draft ?? settings.data ?? {};
  const setValue = (key, v) => setDraft({ ...(draft ?? settings.data ?? {}), [key]: v });
  // Gated on data having loaded (not a bare `true`) — the component early-returns a skeleton
  // below while settings.data is still null, so the ref never attaches to a real element during
  // that render; a hardcoded-true active flag would fire the hook's mount effect against that
  // null ref and then never fire again once the real content (and its ref) actually mounts.
  const glassRef = useLiquidGlass(Boolean(settings.data), { scale: -35, chroma: 2, blur: 8 });

  const save = async () => {
    // Validate number fields before coercing — Number('') is 0, not NaN, so a field the admin
    // cleared out would otherwise silently persist as a real 0 (e.g. degenerating the overtime
    // escalation factor to a flat per-minute penalty) instead of surfacing as a mistake.
    for (const group of groups) {
      for (const f of group.fields) {
        if (f.type === 'number') {
          const raw = values[f.key];
          if (raw === '' || raw == null || Number.isNaN(Number(raw))) {
            toast.error(`"${f.label}" needs a number.`);
            return;
          }
          if (f.min != null && Number(raw) < f.min) {
            toast.error(`"${f.label}" must be at least ${f.min}.`);
            return;
          }
        }
        if (f.type === 'list') {
          const cleaned = (values[f.key] || []).map((s) => s.trim()).filter(Boolean);
          if (cleaned.length === 0) {
            toast.error(`"${f.label}" needs at least one item.`);
            return;
          }
        }
      }
    }
    setSaving(true);
    try {
      // Only send the keys we manage, coerced to their types.
      const patch = {};
      for (const group of groups) {
        for (const f of group.fields) {
          const raw = values[f.key];
          patch[f.key] =
            f.type === 'bool' ? Boolean(raw)
            : f.type === 'text' ? String(raw ?? '')
            : f.type === 'list' ? (raw || []).map((s) => s.trim()).filter(Boolean)
            : Number(raw);
        }
      }
      const updated = await adminApi.updateSettings(patch);
      settings.setData(updated);
      setDraft(null);
      toast.success('Settings saved.');
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  };

  if (settings.loading && !settings.data) return <SettingsSkeleton />;
  if (settings.error) return <ErrorState error={settings.error} onRetry={settings.refetch} title="Could not load settings" />;

  return (
    <div className="space-y-5">
      {groups.map((group, i) => (
        <Card key={group.title} className={ENTER} style={stagger(i)}>
          <CardHeader title={group.title} />
          <div className="grid gap-4 sm:grid-cols-2">
            {group.fields.map((f) =>
              f.type === 'bool' ? (
                <div key={f.key} className="flex items-center justify-between gap-3 rounded-2xl bg-bg-elevated px-3 py-2.5">
                  <span className="text-sm text-content">{f.label}</span>
                  <Switch checked={Boolean(values[f.key])} onChange={(v) => setValue(f.key, v)} label={f.label} />
                </div>
              ) : f.type === 'list' ? (
                <div key={f.key} className="sm:col-span-2">
                  <ListSettingEditor label={f.label} value={values[f.key] || []} onChange={(v) => setValue(f.key, v)} />
                </div>
              ) : (
                <Input
                  key={f.key}
                  label={f.label}
                  type={f.type === 'text' ? 'text' : 'number'}
                  min={f.type === 'number' ? f.min : undefined}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValue(f.key, e.target.value)}
                />
              )
            )}
          </div>
        </Card>
      ))}

      {/* Sticky action bar: floating chrome, so a subtle translucent surface is fair game. */}
      <div ref={glassRef} className="lg-panel sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
        <p className="text-sm text-muted">{draft ? 'You have unsaved changes.' : 'All changes saved.'}</p>
        <Button onClick={save} loading={saving} disabled={!draft}>
          Save settings
        </Button>
      </div>
    </div>
  );
}

/**
 * Editable title/body for every notification template in one `group` (chargers/carpool) —
 * same settings-table + adminApi.updateSettings() plumbing as SettingsEditor, just rendering
 * NOTIFICATION_TEMPLATES entries instead of number/bool/list fields. `{{var}}` placeholders are
 * shown as a hint under each field so an admin knows what's available without guessing.
 */
function NotificationTemplatesEditor({ group }) {
  const templates = NOTIFICATION_TEMPLATES.filter((t) => t.group === group);
  const settings = useApi(() => adminApi.getSettings(), []);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const values = draft ?? settings.data ?? {};
  const setValue = (key, v) => setDraft({ ...(draft ?? settings.data ?? {}), [key]: v });

  const save = async () => {
    const patch = {};
    for (const t of templates) {
      const titleKey = notifTplSettingKey(t.key, 'title');
      const bodyKey = notifTplSettingKey(t.key, 'body');
      const title = String(values[titleKey] ?? '').trim();
      const body = String(values[bodyKey] ?? '').trim();
      if (!title || !body) {
        toast.error(`"${t.label}" needs both a title and a body.`);
        return;
      }
      patch[titleKey] = title;
      patch[bodyKey] = body;
    }
    setSaving(true);
    try {
      const updated = await adminApi.updateSettings(patch);
      settings.setData(updated);
      setDraft(null);
      toast.success('Notification templates saved.');
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  };

  if (settings.loading && !settings.data) return <div className="skeleton h-64 rounded-2xl" />;
  if (settings.error) return <ErrorState error={settings.error} onRetry={settings.refetch} title="Could not load notification templates" />;

  return (
    <Card>
      <CardHeader title="Notification templates" subtitle="Edit the wording sent for each event — {{placeholders}} are filled in automatically" />
      <div className="space-y-5">
        {templates.map((t) => {
          const titleKey = notifTplSettingKey(t.key, 'title');
          const bodyKey = notifTplSettingKey(t.key, 'body');
          return (
            <div key={t.key} className="rounded-2xl border border-border p-3">
              <p className="mb-2 text-sm font-medium text-content">{t.label}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Title" value={values[titleKey] ?? ''} onChange={(e) => setValue(titleKey, e.target.value)} />
                <Input label="Body" value={values[bodyKey] ?? ''} onChange={(e) => setValue(bodyKey, e.target.value)} />
              </div>
              {t.vars.length > 0 && (
                <p className="mt-1.5 text-xs text-faint">
                  Available: {t.vars.map((v) => `{{${v}}}`).join(', ')}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={save} loading={saving} disabled={!draft}>
          Save templates
        </Button>
      </div>
    </Card>
  );
}

// ── General ──────────────────────────────────────────────────────────────────────
// Office identity (name/address/timezone) + registration/signup settings. Office identity uses
// a different endpoint than SettingsEditor's settings-key patch, since these fields are columns
// on the locations row itself, not jsonb `settings` rows.
function GeneralTab() {
  return (
    <div className="space-y-5">
      <OfficeIdentityCard />
      <SettingsEditor groups={GENERAL_SETTING_GROUPS} />
    </div>
  );
}

const IANA_ZONES = (() => {
  try {
    return Intl.supportedValuesOf('timeZone').sort();
  } catch {
    return [];
  }
})();

function OfficeIdentityCard() {
  const office = useApi(() => adminApi.getOffice(), []);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  const values = draft ?? office.data ?? {};
  const setValue = (key, v) => setDraft({ ...(draft ?? office.data ?? {}), [key]: v });

  const save = async () => {
    setSaving(true);
    try {
      const updated = await adminApi.updateOffice({
        name: values.name,
        address: values.address || '',
        timezone: values.timezone,
      });
      office.setData(updated);
      setDraft(null);
      toast.success('Office updated.');
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  };

  if (office.loading && !office.data) return <div className="skeleton h-64 rounded-2xl" />;
  if (office.error) return <ErrorState error={office.error} onRetry={office.refetch} title="Could not load office" />;

  return (
    <Card>
      <CardHeader title="Office" subtitle="Name, address, and timezone for this office" icon={SettingsIcon} />
      <div className="space-y-4">
        <Input label="Name" value={values.name || ''} onChange={(e) => setValue('name', e.target.value)} />
        <Input
          label="Address"
          value={values.address || ''}
          onChange={(e) => setValue('address', e.target.value)}
          hint="We'll look up coordinates automatically when you save — used for the signup geofence check."
          placeholder="123 Main St, City, State"
        />
        {IANA_ZONES.length > 0 ? (
          <Select
            label="Timezone"
            value={values.timezone || ''}
            onChange={(e) => setValue('timezone', e.target.value)}
            options={IANA_ZONES.map((z) => ({ value: z, label: z }))}
          />
        ) : (
          <Input label="Timezone" value={values.timezone || ''} onChange={(e) => setValue('timezone', e.target.value)} placeholder="America/Los_Angeles" />
        )}
        <div className="flex justify-end">
          <Button onClick={save} loading={saving} disabled={!draft}>
            Save office
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Announcements ─────────────────────────────────────────────────────────────────
// Card list (not a table): the message body is long-form prose, which doesn't fit a dense row.
function AnnouncementsTab() {
  const list = useApi(() => adminApi.listAnnouncements(), []);
  const [formOpen, setFormOpen] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const remove = async (a) => {
    if (!(await confirm({ title: 'Delete announcement?', message: a.title, danger: true, confirmLabel: 'Delete' }))) return;
    try {
      await adminApi.deleteAnnouncement(a.id);
      toast.success('Announcement deleted.');
      list.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    }
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" />
          New announcement
        </Button>
      </div>
      {list.loading && !list.data ? (
        <ul className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </ul>
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.refetch} title="Could not load announcements" />
      ) : (list.data || []).length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements" description="Post one to notify everyone at the site." />
      ) : (
        <ul className="space-y-2">
          {list.data.map((a, i) => (
            <Card key={a.id} as="li" className={ENTER} style={stagger(i)}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-content">
                    {a.title}
                    {!a.active && <Badge tone="faint">Inactive</Badge>}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{a.body}</p>
                  <p className="mt-1 text-xs text-faint">{formatDateTime(a.created_at)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(a)} aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </ul>
      )}
      <AnnouncementModal open={formOpen} onClose={() => setFormOpen(false)} onCreated={() => { setFormOpen(false); list.refetch(); }} />
      {confirmDialog}
    </>
  );
}

function AnnouncementModal({ open, onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setErrors({});
    const parsed = announcementSchema.safeParse({ title: title.trim(), body: body.trim(), active: true });
    if (!parsed.success) {
      const fe = {};
      for (const issue of parsed.error.issues) fe[issue.path[0] ?? '_form'] = issue.message;
      setErrors(fe);
      return;
    }
    setSaving(true);
    try {
      await adminApi.createAnnouncement(parsed.data);
      toast.success('Announcement posted.');
      setTitle('');
      setBody('');
      onCreated();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New announcement"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Post</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} />
        <Textarea label="Message" rows={4} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} error={errors.body} />
      </div>
    </Modal>
  );
}

// ── Users ───────────────────────────────────────────────────────────────────────
// Cards on compact, a dense data table on expanded (name, email, credits, joined, actions).
function UsersTab() {
  const viewerRole = useAuthStore((s) => s.user?.role);
  const isSuperAdmin = viewerRole === ROLES.SUPER_ADMIN;
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const users = useApi(() => adminApi.listUsers(1, query), [query]);
  const [busyId, setBusyId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetFor, setResetFor] = useState(null);
  const [tempPassword, setTempPassword] = useState(null);
  const [confirm, confirmDialog] = useConfirm();

  const act = async (userId, patch) => {
    setBusyId(userId);
    try {
      await adminApi.updateUser(userId, patch);
      toast.success('User updated.');
      users.refetch();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (u) => {
    if (!(await confirm({
      title: 'Reset this password?',
      message: `Set a new temporary password for ${u.displayName}? Their existing sessions will be signed out and they'll need this new password to sign back in.`,
      confirmLabel: 'Reset password',
    }))) return;
    setBusyId(u.id);
    try {
      const { tempPassword: pw } = await adminApi.resetUserPassword(u.id);
      setResetFor(u);
      setTempPassword(pw);
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setBusyId(null);
    }
  };

  const items = users.data?.items || [];

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
          }}
        >
          <Input className="flex-1" placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button type="submit" variant="secondary" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
        </form>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create admin/user
        </Button>
      </div>

      {users.loading && !users.data ? (
        <ul className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </ul>
      ) : users.error ? (
        <ErrorState error={users.error} onRetry={users.refetch} title="Could not load users" />
      ) : items.length === 0 ? (
        <EmptyState icon={UsersIcon} title="No users found" />
      ) : (
        <>
          {/* Compact / medium: stacked cards. */}
          <ul className="space-y-2 expanded:hidden">
            {items.map((u, i) => (
              <Card key={u.id} as="li" className={cn('flex items-center justify-between gap-3', ENTER)} style={stagger(i)}>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-content">
                    {u.displayName}
                    {u.role !== 'user' && <Badge tone="brand">{ROLE_LABEL[u.role]}</Badge>}
                    {!u.active && <Badge tone="danger">Disabled</Badge>}
                  </p>
                  <p className="truncate text-sm text-muted">{u.email}</p>
                  <p className="text-xs text-faint">{u.carpoolCredits} credits</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Select
                    aria-label="Role"
                    value={u.role}
                    disabled={busyId === u.id}
                    onChange={(e) => act(u.id, { role: e.target.value })}
                    options={[
                      { value: 'user', label: 'User' },
                      { value: 'site_admin', label: 'Site admin' },
                      ...(isSuperAdmin ? [{ value: 'super_admin', label: 'Super admin' }] : []),
                    ]}
                  />
                  <Button size="sm" variant="ghost" loading={busyId === u.id} onClick={() => resetPassword(u)}>
                    <KeyRound className="h-4 w-4" />
                    Reset password
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className={u.active ? 'text-danger' : ''}
                    loading={busyId === u.id}
                    onClick={() => act(u.id, { active: !u.active })}
                  >
                    {u.active ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </Card>
            ))}
          </ul>

          {/* Expanded+: dense data table. */}
          <div className="hidden overflow-hidden rounded-2xl border border-border expanded:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className={TH}>User</th>
                  <th className={TH}>Email</th>
                  <th className={cn(TH, 'text-right')}>Credits</th>
                  <th className={TH}>Joined</th>
                  <th className={cn(TH, 'text-right')}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((u, i) => (
                  <tr key={u.id} className={cn('transition-colors hover:bg-surface-2', ROW_ENTER)} style={stagger(i)}>
                    <td className={TD}>
                      <span className="flex items-center gap-2 font-medium text-content">
                        {u.displayName}
                        {u.role !== 'user' && <Badge tone="brand">{ROLE_LABEL[u.role]}</Badge>}
                        {!u.active && <Badge tone="danger">Disabled</Badge>}
                      </span>
                    </td>
                    <td className={cn(TD, 'text-muted')}>{u.email}</td>
                    <td className={cn(TD, 'text-right tabular-nums text-content')}>{u.carpoolCredits}</td>
                    <td className={cn(TD, 'whitespace-nowrap text-faint')}>{u.createdAt ? formatDateTime(u.createdAt) : '—'}</td>
                    <td className={TD}>
                      <div className="flex justify-end gap-1">
                        <Select
                          aria-label="Role"
                          value={u.role}
                          disabled={busyId === u.id}
                          onChange={(e) => act(u.id, { role: e.target.value })}
                          options={[
                            { value: 'user', label: 'User' },
                            { value: 'site_admin', label: 'Site admin' },
                            ...(isSuperAdmin ? [{ value: 'super_admin', label: 'Super admin' }] : []),
                          ]}
                        />
                        <Button size="sm" variant="ghost" loading={busyId === u.id} onClick={() => resetPassword(u)}>
                          <KeyRound className="h-4 w-4" />
                          Reset password
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className={u.active ? 'text-danger' : ''}
                          loading={busyId === u.id}
                          onClick={() => act(u.id, { active: !u.active })}
                        >
                          {u.active ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <CreateUserModal
        open={createOpen}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); users.refetch(); }}
      />
      <TempPasswordModal
        user={resetFor}
        password={tempPassword}
        onClose={() => {
          setResetFor(null);
          setTempPassword(null);
        }}
      />
      {confirmDialog}
    </>
  );
}

function TempPasswordModal({ user, password, onClose }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select and copy the password manually.");
    }
  };

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title={`New password for ${user?.displayName || 'this user'}`}
      size="sm"
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Share this with them directly — it won't be shown again. They can change it from Settings after signing in.
        </p>
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-bg-elevated px-3 py-2.5">
          <code className="flex-1 select-all font-mono text-sm text-content">{password}</code>
          <Button size="sm" variant="ghost" onClick={copy} aria-label="Copy password">
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CreateUserModal({ open, isSuperAdmin, onClose, onCreated }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setEmail('');
    setDisplayName('');
    setPassword('');
    setRole('user');
    setErrors({});
  };

  const submit = async () => {
    setErrors({});
    const parsed = adminCreateUserSchema.safeParse({ email: email.trim(), displayName: displayName.trim(), password, role });
    if (!parsed.success) {
      const fe = {};
      for (const issue of parsed.error.issues) fe[issue.path[0] ?? '_form'] = issue.message;
      setErrors(fe);
      return;
    }
    setSaving(true);
    try {
      await adminApi.createUser(parsed.data);
      toast.success('Account created.');
      reset();
      onCreated();
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Create admin/user"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Create</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Input label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} error={errors.displayName} />
        <Input
          label="Temporary password"
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint="Share this with the new user — they can change it after logging in."
        />
        <Select
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          error={errors.role}
          options={[
            { value: 'user', label: 'User' },
            { value: 'site_admin', label: 'Site admin' },
            ...(isSuperAdmin ? [{ value: 'super_admin', label: 'Super admin' }] : []),
          ]}
        />
      </div>
    </Modal>
  );
}

// ── Audit ───────────────────────────────────────────────────────────────────────
// Stacked list on compact, dense table on expanded (action, details, when).
function AuditTab() {
  const audit = useApi(() => adminApi.audit(1), []);

  if (audit.loading && !audit.data) {
    return (
      <ul className="space-y-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="skeleton h-12 rounded-2xl" />
        ))}
      </ul>
    );
  }
  if (audit.error) return <ErrorState error={audit.error} onRetry={audit.refetch} title="Could not load activity" />;

  const items = audit.data?.items || [];
  if (items.length === 0) {
    return <EmptyState icon={ScrollText} title="No activity yet" description="Admin and system actions will appear here." />;
  }

  const detailText = (a) => (a.details == null ? '' : typeof a.details === 'string' ? a.details : JSON.stringify(a.details));

  return (
    <>
      {/* Compact / medium: stacked rows. */}
      <ul className="space-y-1.5 expanded:hidden">
        {items.map((a, i) => (
          <li
            key={a.id}
            className={cn('flex items-start justify-between gap-3 rounded-2xl bg-bg-elevated px-3 py-2 text-sm', ROW_ENTER)}
            style={stagger(i)}
          >
            <div className="min-w-0">
              <p className="font-medium text-content">{a.action}</p>
              {detailText(a) && <p className="truncate text-xs text-muted">{detailText(a)}</p>}
            </div>
            <span className="shrink-0 text-xs text-faint">{formatDateTime(a.created_at)}</span>
          </li>
        ))}
      </ul>

      {/* Expanded+: dense data table. */}
      <div className="hidden overflow-hidden rounded-2xl border border-border expanded:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <th className={TH}>Action</th>
              <th className={TH}>Details</th>
              <th className={cn(TH, 'text-right')}>When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((a, i) => (
              <tr key={a.id} className={cn('transition-colors hover:bg-surface-2', ROW_ENTER)} style={stagger(i)}>
                <td className={cn(TD, 'whitespace-nowrap font-medium text-content')}>{a.action}</td>
                <td className={cn(TD, 'max-w-0 truncate text-muted')}>{detailText(a)}</td>
                <td className={cn(TD, 'whitespace-nowrap text-right text-faint')}>{formatDateTime(a.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
