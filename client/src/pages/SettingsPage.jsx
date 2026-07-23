import { useState } from 'react';
import {
  UserCircle, Car, KeyRound, Zap, Leaf, LogOut, Settings as SettingsIcon,
  SlidersHorizontal, RotateCcw, Smartphone, Sun, Moon, Bell, Palette, Check, Info, ShieldCheck,
} from 'lucide-react';
import { updateProfileSchema, changePasswordSchema } from '@shared/validation.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Tabs } from '@/components/common/Tabs.jsx';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Input } from '@/components/common/Input.jsx';
import { Spinner, ErrorState } from '@/components/common/States.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useAuthStore } from '@/stores/authStore.js';
import { useThemeStore } from '@/stores/themeStore.js';
import { userApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { NOTIFICATION_TYPES } from '@/utils/constants.js';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow.jsx';
import { Switch } from '@/components/common/Switch.jsx';
import { cn } from '@/utils/cn.js';

// Settings is a list-detail screen: a segmented tab bar on compact/medium collapses to a
// persistent section rail at xl (matching the app's own nav-changes-by-breakpoint pattern).
// The rail is gated at xl, not expanded, because the 288px permanent drawer would leave too
// little width for a two-pane split at 840px.
const SECTIONS = [
  { key: 'profile', label: 'Profile', icon: UserCircle },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'security', label: 'Security', icon: ShieldCheck },
  { key: 'about', label: 'About & help', icon: Info },
];

// Theme preview palettes. These intentionally use FIXED hex values, not the live --c-* tokens:
// each swatch must depict one specific theme regardless of which theme is currently active, so
// it can't inherit the runtime variables. Values mirror the light/dark palettes in index.css.
const PALETTE = {
  light: { bg: '#fafafc', surface: '#ffffff', brand: '#3c79bc', line: '#dee0e5' },
  dark: { bg: '#000000', surface: '#121214', brand: '#5a96d6', line: '#2c2d31' },
};

const THEME_OPTIONS = [
  { key: 'device', label: 'Device', icon: Smartphone },
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
];

const PREF_TOGGLES = [
  { key: NOTIFICATION_TYPES.QUEUE_TURN, label: 'Queue turn alerts', hint: "When it's your turn to charge" },
  { key: NOTIFICATION_TYPES.SESSION_OVERTIME, label: 'Overtime reminders', hint: 'When your session runs over' },
  { key: NOTIFICATION_TYPES.CARPOOL_BOOKING, label: 'Carpool bookings', hint: 'Seat requests and confirmations' },
  { key: NOTIFICATION_TYPES.CARPOOL_MATCH, label: 'Carpool matches', hint: 'When a driver matches your request' },
  { key: NOTIFICATION_TYPES.ANNOUNCEMENT, label: 'Announcements', hint: 'Site-wide messages from admins' },
];

export default function SettingsPage() {
  const [section, setSection] = useState('profile');
  const user = useAuthStore((s) => s.user);
  if (!user) return <Spinner label="Loading your settings…" />;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Settings" description="Your account, preferences, and how the app works." icon={SettingsIcon} />

      {/* Compact / medium: segmented section switcher. Hidden once the rail takes over at xl. */}
      <div className="xl:hidden">
        <Tabs tabs={SECTIONS} value={section} onChange={setSection} />
      </div>

      <div className="xl:grid xl:grid-cols-[248px_1fr] xl:gap-6">
        {/* Persistent section rail — MD3 secondary navigation, large windows only. */}
        <nav aria-label="Settings sections" className="hidden xl:block">
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
          {section === 'profile' && <ProfileSection user={user} />}
          {section === 'notifications' && <NotificationsSection user={user} />}
          {section === 'appearance' && <AppearanceSection />}
          {section === 'security' && <SecuritySection />}
          {section === 'about' && <AboutSection />}
        </div>
      </div>
    </div>
  );
}

// ── Profile ──────────────────────────────────────────────────────────────────────
function ProfileSection({ user }) {
  const patchUser = useAuthStore((s) => s.patchUser);
  const logout = useAuthStore((s) => s.logout);
  const stats = useApi(() => userApi.stats(), []);

  return (
    <div className="space-y-5">
      <StatsCard stats={stats} />
      <ProfileCard user={user} onSaved={patchUser} />
      <Button variant="ghost" className="w-full text-danger" onClick={logout}>
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}

function StatsCard({ stats }) {
  const s = stats.data;
  return (
    <Card>
      <CardHeader title="Your usage" subtitle="Sessions this week and carpool impact" icon={Zap} />
      {stats.loading && !stats.data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-[78px] rounded-xl" />
          ))}
        </div>
      ) : stats.error ? (
        <ErrorState error={stats.error} onRetry={stats.refetch} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={Zap} label="This week" value={`${s?.weeklySessionsUsed ?? 0}/${s?.weeklySessionsMax ?? 0}`} />
          <Stat icon={Zap} label="Total sessions" value={s?.totalSessions ?? 0} />
          <Stat icon={Leaf} label="CO₂ saved" value={`${s?.carpool?.co2Kg ?? 0} kg`} />
          <Stat icon={Car} label="Carpool trips" value={s?.carpool?.trips ?? 0} />
        </div>
      )}
    </Card>
  );
}

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl bg-bg-elevated p-3">
      <Icon className="mb-1 h-4 w-4 text-brand-strong" />
      <p className="text-lg font-bold text-content tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function ProfileCard({ user, onSaved }) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [vehicleDescription, setVehicleDescription] = useState(user.vehicleDescription || '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setErrors({});
    const parsed = updateProfileSchema.safeParse({
      displayName: displayName.trim(),
      vehicleDescription: vehicleDescription.trim(),
    });
    if (!parsed.success) {
      const fe = {};
      for (const issue of parsed.error.issues) fe[issue.path[0] ?? '_form'] = issue.message;
      setErrors(fe);
      return;
    }
    setSaving(true);
    try {
      const updated = await userApi.updateMe(parsed.data);
      onSaved(updated);
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Account" subtitle="How you appear to others at the site" icon={UserCircle} />
      <div className="space-y-4">
        <Input label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} error={errors.displayName} />
        <Input label="Email" value={user.email} disabled hint="Contact an admin to change your email." />
        <Input label="Vehicle" value={vehicleDescription} onChange={(e) => setVehicleDescription(e.target.value)} error={errors.vehicleDescription} placeholder="Blue Tesla Model 3" />
        <div className="flex justify-end">
          <Button onClick={save} loading={saving}>
            Save changes
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Notifications ──────────────────────────────────────────────────────────────────
function NotificationsSection({ user }) {
  const patchUser = useAuthStore((s) => s.patchUser);
  const [prefs, setPrefs] = useState(user.notificationPrefs || {});
  const [saving, setSaving] = useState(false);

  const isOn = (key) => prefs[key] !== false; // default opted-in
  const toggle = (key) => setPrefs((cur) => ({ ...cur, [key]: !isOn(key) }));

  const save = async () => {
    setSaving(true);
    try {
      const updated = await userApi.updateMe({ notificationPrefs: prefs });
      patchUser(updated);
      toast.success('Preferences saved.');
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Notification preferences" subtitle="Choose what you're alerted about" icon={Bell} />
      <ul className="divide-y divide-border">
        {PREF_TOGGLES.map((t) => (
          <li key={t.key} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-medium text-content">{t.label}</p>
              <p className="text-sm text-muted">{t.hint}</p>
            </div>
            <Switch checked={isOn(t.key)} onChange={() => toggle(t.key)} label={t.label} />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-end">
        <Button onClick={save} loading={saving}>
          Save preferences
        </Button>
      </div>
    </Card>
  );
}

// ── Appearance ─────────────────────────────────────────────────────────────────────
/** Miniature app-window preview for a theme option (or a two-tone split for "device"). */
function ThemePreview({ optKey }) {
  const isDevice = optKey === 'device';
  const p = optKey === 'dark' ? PALETTE.dark : PALETTE.light;
  return (
    <span
      className="relative block h-14 w-full overflow-hidden rounded-xl border border-border"
      style={
        isDevice
          ? { background: `linear-gradient(120deg, ${PALETTE.light.bg} 0 52%, ${PALETTE.dark.bg} 52% 100%)` }
          : { background: p.bg }
      }
    >
      {/* Representative surface card + brand accent bar. */}
      <span
        className="absolute left-2 top-2 flex h-8 w-[64%] items-center rounded-md px-1.5"
        style={{ background: p.surface, border: `1px solid ${p.line}` }}
      >
        <span className="h-1.5 w-7 rounded-full" style={{ background: p.brand }} />
      </span>
      {isDevice && (
        <span
          className="absolute bottom-1.5 right-2 flex h-5 w-5 items-center justify-center rounded-md"
          style={{ background: PALETTE.dark.surface, border: `1px solid ${PALETTE.dark.line}` }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: PALETTE.dark.brand }} />
        </span>
      )}
    </span>
  );
}

function AppearanceSection() {
  const themePref = useThemeStore((s) => s.pref);
  const setThemePref = useThemeStore((s) => s.setPref);

  return (
    <Card>
      <CardHeader title="Appearance" subtitle="Choose how EV Hub looks" icon={Palette} />
      <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-3">
        {THEME_OPTIONS.map((opt) => {
          const active = themePref === opt.key;
          const OptIcon = opt.icon;
          return (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setThemePref(opt.key)}
              className={cn(
                'group relative flex flex-col items-center gap-3 rounded-2xl border p-3 text-center',
                'transition-[background-color,border-color] duration-medium ease-emphasized',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/80',
                active ? 'border-brand bg-brand/10' : 'border-border hover:border-border-strong hover:bg-surface-2'
              )}
            >
              <ThemePreview optKey={opt.key} />
              <span className={cn('flex items-center gap-1.5 text-sm font-medium', active ? 'text-brand-strong' : 'text-muted group-hover:text-content')}>
                <OptIcon className="h-4 w-4" />
                {opt.label}
              </span>
              {active && (
                <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-brand text-brand-content">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-faint">
        Dark uses a true black (AMOLED) background. Device follows your system setting automatically.
      </p>
    </Card>
  );
}

// ── Security ─────────────────────────────────────────────────────────────────────
function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setErrors({});
    const parsed = changePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!parsed.success) {
      const fe = {};
      for (const issue of parsed.error.issues) fe[issue.path[0] ?? '_form'] = issue.message;
      setErrors(fe);
      return;
    }
    setSaving(true);
    try {
      await userApi.changePassword(parsed.data);
      toast.success('Password changed.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Change password" subtitle="Use a strong, unique password" icon={KeyRound} />
      <div className="space-y-4">
        <Input label="Current password" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} error={errors.currentPassword} />
        <Input label="New password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} error={errors.newPassword} hint="8+ chars, with upper, lower, number & symbol." />
        <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={errors.confirmPassword} />
        <div className="flex justify-end">
          <Button onClick={save} loading={saving}>
            Update password
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── About & help ─────────────────────────────────────────────────────────────────
function AboutSection() {
  const patchUser = useAuthStore((s) => s.patchUser);
  const [replaying, setReplaying] = useState(false);
  const [resetting, setResetting] = useState(false);

  const replay = async () => {
    setResetting(true);
    try {
      const updated = await userApi.resetOnboarding();
      patchUser(updated);
      setReplaying(true);
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setResetting(false);
    }
  };

  const finishReplay = async () => {
    setReplaying(false);
    try {
      const updated = await userApi.completeOnboarding();
      patchUser(updated);
    } catch (err) {
      toast.error(normalizeError(err).message);
    }
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="How the app works" subtitle="Replay the welcome walkthrough any time" icon={SlidersHorizontal} />
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            A quick tour of chargers, queueing, nudges, carpooling, and notifications.
          </p>
          <Button variant="secondary" onClick={replay} loading={resetting} className="shrink-0">
            <RotateCcw className="h-4 w-4" />
            Replay
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader title="About" icon={Info} />
        <dl className="space-y-2.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">App</dt>
            <dd className="font-medium text-content">EV Hub — Astera Labs</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted">Built by</dt>
            <dd className="font-medium text-content">Team Go Bananas — Astera Labs 2026 Hackathon</dd>
          </div>
        </dl>
      </Card>

      {replaying && <OnboardingFlow onFinish={finishReplay} />}
    </div>
  );
}
