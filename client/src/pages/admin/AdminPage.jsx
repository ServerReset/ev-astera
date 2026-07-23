import { useState } from 'react';
import {
  ShieldCheck, Activity, Zap, Settings as SettingsIcon, Megaphone, Users as UsersIcon, ScrollText,
  Plus, Trash2, Power, PowerOff, StopCircle, Search,
} from 'lucide-react';
import { announcementSchema, adminCreateUserSchema } from '@shared/validation.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Tabs } from '@/components/common/Tabs.jsx';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Modal } from '@/components/common/Modal.jsx';
import { Input, Textarea, Select } from '@/components/common/Input.jsx';
import { Badge } from '@/components/common/Badge.jsx';
import { Spinner, EmptyState, ErrorState } from '@/components/common/States.jsx';
import { useConfirm } from '@/components/common/ConfirmDialog.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useRealtime } from '@/hooks/useRealtime.js';
import { adminApi, chargerApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { formatDateTime } from '@/utils/time.js';
import { ENV, CHARGER_STATUS_META, SETTING_KEYS } from '@/utils/constants.js';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Activity },
  { key: 'chargers', label: 'Chargers', icon: Zap },
  { key: 'settings', label: 'Settings', icon: SettingsIcon },
  { key: 'announce', label: 'Announcements', icon: Megaphone },
  { key: 'users', label: 'Users', icon: UsersIcon },
  { key: 'audit', label: 'Activity', icon: ScrollText },
];

export default function AdminPage() {
  const [tab, setTab] = useState('overview');
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Admin" description="Operational controls and configuration for your site." icon={ShieldCheck} />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'overview' && <OverviewTab />}
      {tab === 'chargers' && <ChargersTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'announce' && <AnnouncementsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────────
function OverviewTab() {
  const overview = useApi(() => adminApi.overview(), []);
  useRealtime('admin-overview', ['sessions', 'queue_entries', 'carpool_rides'], overview.refetch, {
    filter: ENV.locationId ? `location_id=eq.${ENV.locationId}` : undefined,
  });

  if (overview.loading && !overview.data) return <Spinner />;
  if (overview.error) return <ErrorState error={overview.error} onRetry={overview.refetch} />;
  const o = overview.data || {};
  const tiles = [
    { label: 'Active sessions', value: o.activeSessions, icon: Zap },
    { label: 'Waiting in queue', value: o.queueWaiting, icon: UsersIcon },
    { label: 'Active users', value: o.activeUsers, icon: UsersIcon },
    { label: 'Sessions (24h)', value: o.sessionsLast24h, icon: Activity },
    { label: 'Open carpool rides', value: o.carpoolOpenRides, icon: Activity },
    { label: 'CO₂ saved this week', value: `${o.carpoolCo2KgThisWeek ?? 0} kg`, icon: Activity },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {tiles.map((t) => (
        <Card key={t.label}>
          <t.icon className="mb-2 h-5 w-5 text-brand-strong" />
          <p className="text-2xl font-bold text-content tabular-nums">{t.value ?? 0}</p>
          <p className="text-sm text-muted">{t.label}</p>
        </Card>
      ))}
    </div>
  );
}

// ── Chargers ─────────────────────────────────────────────────────────────────────
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

  if (chargers.loading && !chargers.data) return <Spinner />;
  if (chargers.error) return <ErrorState error={chargers.error} onRetry={chargers.refetch} />;

  const list = chargers.data || [];

  return (
    <>
      {list.length === 0 ? (
        <EmptyState icon={Zap} title="No chargers configured" description="Add chargers to this site to start tracking sessions." />
      ) : (
        <div className="space-y-2">
          {list.map((c) => {
            const meta = CHARGER_STATUS_META[c.status] || CHARGER_STATUS_META.available;
            return (
              <Card key={c.id}>
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

  if (settings.loading && !settings.data) return <Spinner />;
  if (settings.error) return <ErrorState error={settings.error} onRetry={settings.refetch} />;

  return (
    <div className="space-y-5">
      {SETTING_GROUPS.map((group) => (
        <Card key={group.title}>
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
                    onClick={() => setValue(f.key, !values[f.key])}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${values[f.key] ? 'bg-brand' : 'bg-surface-2'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${values[f.key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
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
      <div className="flex justify-end">
        <Button onClick={save} loading={saving} disabled={!draft}>
          Save settings
        </Button>
      </div>
    </div>
  );
}

// ── Announcements ─────────────────────────────────────────────────────────────────
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
        <Spinner />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.refetch} />
      ) : (list.data || []).length === 0 ? (
        <EmptyState icon={Megaphone} title="No announcements" description="Post one to notify everyone at the site." />
      ) : (
        <ul className="space-y-2">
          {list.data.map((a) => (
            <Card key={a.id} as="li">
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

// ── Users ─────────────────────────────────────────────────────────────────────────
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

  return (
    <>
      <div className="mb-4 flex gap-2">
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search.trim());
          }}
        >
          <Input className="flex-1" placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button type="submit" variant="secondary">
            <Search className="h-4 w-4" />
          </Button>
        </form>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create admin/user
        </Button>
      </div>

      {users.loading && !users.data ? (
        <Spinner />
      ) : users.error ? (
        <ErrorState error={users.error} onRetry={users.refetch} />
      ) : (users.data?.items || []).length === 0 ? (
        <EmptyState icon={UsersIcon} title="No users found" />
      ) : (
        <ul className="space-y-2">
          {users.data.items.map((u) => (
            <Card key={u.id} as="li" className="flex items-center justify-between gap-3">
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
function AuditTab() {
  const audit = useApi(() => adminApi.audit(1), []);
  if (audit.loading && !audit.data) return <Spinner />;
  if (audit.error) return <ErrorState error={audit.error} onRetry={audit.refetch} />;
  const items = audit.data?.items || [];
  return items.length === 0 ? (
    <EmptyState icon={ScrollText} title="No activity yet" description="Admin and system actions will appear here." />
  ) : (
    <ul className="space-y-1.5">
      {items.map((a) => (
        <li key={a.id} className="flex items-start justify-between gap-3 rounded-xl bg-bg-elevated px-3 py-2 text-sm">
          <div className="min-w-0">
            <p className="font-medium text-content">{a.action}</p>
            {a.details && <p className="truncate text-xs text-muted">{typeof a.details === 'string' ? a.details : JSON.stringify(a.details)}</p>}
          </div>
          <span className="shrink-0 text-xs text-faint">{formatDateTime(a.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}
