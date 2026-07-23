import { useState } from 'react';
import {
  ShieldCheck, Activity, Zap, Settings as SettingsIcon, Megaphone, Users as UsersIcon, ScrollText,
  Plus, Trash2, Power, PowerOff, StopCircle, Search, Car, Leaf,
} from 'lucide-react';
import { announcementSchema, adminCreateUserSchema } from '@shared/validation.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Tabs } from '@/components/common/Tabs.jsx';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Modal } from '@/components/common/Modal.jsx';
import { Input, Textarea, Select } from '@/components/common/Input.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { EmptyState, ErrorState } from '@/components/common/States.jsx';
import { useConfirm } from '@/components/common/ConfirmDialog.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useRealtime } from '@/hooks/useRealtime.js';
import { adminApi, chargerApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { formatDateTime } from '@/utils/time.js';
import { cn } from '@/utils/cn.js';
import { ENV, CHARGER_STATUS_META, SETTING_KEYS } from '@/utils/constants.js';

// Admin is a console: a segmented section switcher on compact/medium collapses to a persistent
// section rail at xl, matching the app's own nav-changes-by-breakpoint pattern (bottom bar →
// rail → drawer). The rail is gated at xl, not expanded, for the same reason as Dashboard/
// Settings — the 288px permanent app drawer already claims width, so a second column of nav
// only has room once the viewport is genuinely laptop-wide.
const SECTIONS = [
  { key: 'overview', label: 'Overview', icon: Activity },
  { key: 'chargers', label: 'Chargers', icon: Zap },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
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

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Admin" description="Operational controls and configuration for your site." icon={ShieldCheck} />

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

        {/* Detail panel — re-keyed so it animates in on section change. */}
        <div key={section} className="animate-fade-in">
          {section === 'overview' && <OverviewTab />}
          {section === 'chargers' && <ChargersTab />}
          {section === 'settings' && <SettingsTab />}
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
  useRealtime('admin-overview', ['sessions', 'queue_entries', 'carpool_rides'], overview.refetch, {
    filter: ENV.locationId ? `location_id=eq.${ENV.locationId}` : undefined,
  });

  if (overview.loading && !overview.data) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-[120px] rounded-2xl" />
        ))}
      </div>
    );
  }
  if (overview.error) return <ErrorState error={overview.error} onRetry={overview.refetch} />;

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
          <span className={cn('mb-3 inline-grid h-10 w-10 place-items-center rounded-xl', TONE_CHIP[t.tone])}>
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
  const [confirm, confirmDialog] = useConfirm();

  useRealtime('admin-chargers', ['chargers', 'sessions'], chargers.refetch, {
    filter: ENV.locationId ? `location_id=eq.${ENV.locationId}` : undefined,
  });

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

  if (chargers.loading && !chargers.data) {
    return (
      <div className="grid gap-3 expanded:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-[132px] rounded-2xl" />
        ))}
      </div>
    );
  }
  if (chargers.error) return <ErrorState error={chargers.error} onRetry={chargers.refetch} />;

  const list = chargers.data || [];

  return (
    <>
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
      {confirmDialog}
    </>
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

// ── Settings ─────────────────────────────────────────────────────────────────────
// Human labels + input types for each business-rule setting. Grouped for the form.
const SETTING_GROUPS = [
  {
    title: 'Sessions & queue',
    fields: [
      { key: SETTING_KEYS.MAX_SESSION_HOURS, label: 'Max session length (hours)', type: 'number' },
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
    ],
  },
  {
    title: 'Emergencies',
    fields: [
      { key: SETTING_KEYS.EMERGENCY_COOLDOWN_HOURS, label: 'Emergency cooldown (hours)', type: 'number' },
      { key: SETTING_KEYS.EMERGENCY_RESPONSE_WINDOW_MINUTES, label: 'Emergency response window (min)', type: 'number' },
    ],
  },
  {
    title: 'Carpool',
    fields: [
      { key: SETTING_KEYS.CARPOOL_ENABLED, label: 'Carpool enabled', type: 'bool' },
      { key: SETTING_KEYS.CARPOOL_PRIORITY_ENABLED, label: 'Give carpool drivers queue priority', type: 'bool' },
      { key: SETTING_KEYS.CARPOOL_MIN_LEAD_MINUTES, label: 'Min ride lead time (min)', type: 'number' },
      { key: SETTING_KEYS.CARPOOL_MAX_DETOUR_MILES, label: 'Max detour (miles)', type: 'number' },
      { key: SETTING_KEYS.CARPOOL_MIN_MATCH_SCORE, label: 'Min match score (0–100)', type: 'number' },
      { key: SETTING_KEYS.CARPOOL_CO2_GRAMS_PER_MILE, label: 'CO₂ grams saved per mile', type: 'number' },
      { key: SETTING_KEYS.CARPOOL_CREDIT_PER_TRIP, label: 'Credits per trip (driver)', type: 'number' },
      { key: SETTING_KEYS.CARPOOL_CREDIT_PER_RIDER, label: 'Credits per rider', type: 'number' },
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
              <div key={j} className="skeleton h-[52px] rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingsTab() {
  const settings = useApi(() => adminApi.getSettings(), []);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  // Initialize the editable draft from the fetched settings once.
  const values = draft ?? settings.data ?? {};
  const setValue = (key, v) => setDraft({ ...(draft ?? settings.data ?? {}), [key]: v });

  const save = async () => {
    setSaving(true);
    try {
      // Only send the keys we manage, coerced to their types.
      const patch = {};
      for (const group of SETTING_GROUPS) {
        for (const f of group.fields) {
          const raw = values[f.key];
          patch[f.key] = f.type === 'bool' ? Boolean(raw) : Number(raw);
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
  if (settings.error) return <ErrorState error={settings.error} onRetry={settings.refetch} />;

  return (
    <div className="space-y-5">
      {SETTING_GROUPS.map((group, i) => (
        <Card key={group.title} className={ENTER} style={stagger(i)}>
          <CardHeader title={group.title} />
          <div className="grid gap-4 sm:grid-cols-2">
            {group.fields.map((f) =>
              f.type === 'bool' ? (
                <label key={f.key} className="flex items-center justify-between gap-3 rounded-xl bg-bg-elevated px-3 py-2.5">
                  <span className="text-sm text-content">{f.label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(values[f.key])}
                    aria-label={f.label}
                    onClick={() => setValue(f.key, !values[f.key])}
                    className={cn(
                      'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-medium ease-standard',
                      values[f.key] ? 'bg-brand' : 'bg-surface-2'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-medium ease-emphasized',
                        values[f.key] ? 'translate-x-5' : 'translate-x-0.5'
                      )}
                    />
                  </button>
                </label>
              ) : (
                <Input
                  key={f.key}
                  label={f.label}
                  type="number"
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValue(f.key, e.target.value)}
                />
              )
            )}
          </div>
        </Card>
      ))}

      {/* Sticky action bar: floating chrome, so a subtle translucent surface is fair game. */}
      <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface/85 px-4 py-3 backdrop-blur-sm">
        <p className="text-sm text-muted">{draft ? 'You have unsaved changes.' : 'All changes saved.'}</p>
        <Button onClick={save} loading={saving} disabled={!draft}>
          Save settings
        </Button>
      </div>
    </div>
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
        <ErrorState error={list.error} onRetry={list.refetch} />
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
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const users = useApi(() => adminApi.listUsers(1, query), [query]);
  const [busyId, setBusyId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

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
        <ErrorState error={users.error} onRetry={users.refetch} />
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
                    {u.role === 'admin' && <Badge tone="brand">Admin</Badge>}
                    {!u.active && <Badge tone="danger">Disabled</Badge>}
                  </p>
                  <p className="truncate text-sm text-muted">{u.email}</p>
                  <p className="text-xs text-faint">{u.carpoolCredits} credits</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busyId === u.id}
                    onClick={() => act(u.id, { role: u.role === 'admin' ? 'user' : 'admin' })}
                  >
                    {u.role === 'admin' ? 'Revoke admin' : 'Make admin'}
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
                        {u.role === 'admin' && <Badge tone="brand">Admin</Badge>}
                        {!u.active && <Badge tone="danger">Disabled</Badge>}
                      </span>
                    </td>
                    <td className={cn(TD, 'text-muted')}>{u.email}</td>
                    <td className={cn(TD, 'text-right tabular-nums text-content')}>{u.carpoolCredits}</td>
                    <td className={cn(TD, 'whitespace-nowrap text-faint')}>{u.createdAt ? formatDateTime(u.createdAt) : '—'}</td>
                    <td className={TD}>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={busyId === u.id}
                          onClick={() => act(u.id, { role: u.role === 'admin' ? 'user' : 'admin' })}
                        >
                          {u.role === 'admin' ? 'Revoke admin' : 'Make admin'}
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
      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); users.refetch(); }} />
    </>
  );
}

function CreateUserModal({ open, onClose, onCreated }) {
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
          options={[{ value: 'user', label: 'User' }, { value: 'admin', label: 'Admin' }]}
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
          <li key={i} className="skeleton h-12 rounded-xl" />
        ))}
      </ul>
    );
  }
  if (audit.error) return <ErrorState error={audit.error} onRetry={audit.refetch} />;

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
            className={cn('flex items-start justify-between gap-3 rounded-xl bg-bg-elevated px-3 py-2 text-sm', ROW_ENTER)}
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
