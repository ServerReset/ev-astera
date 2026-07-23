import { useState } from 'react';
import { UserCircle, Car, KeyRound, Zap, Leaf, LogOut } from 'lucide-react';
import { updateProfileSchema, changePasswordSchema } from '@shared/validation.js';
import { PageHeader } from '@/components/layout/PageHeader.jsx';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Input } from '@/components/common/Input.jsx';
import { Spinner } from '@/components/common/States.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useAuthStore } from '@/stores/authStore.js';
import { userApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { NOTIFICATION_TYPES } from '@/utils/constants.js';

// The notification preferences a user can toggle. Keys match `notification_prefs` on the user
// row; the server treats a missing/true value as opted-in.
const PREF_TOGGLES = [
  { key: NOTIFICATION_TYPES.QUEUE_TURN, label: 'Queue turn alerts', hint: "When it's your turn to charge" },
  { key: NOTIFICATION_TYPES.SESSION_OVERTIME, label: 'Overtime reminders', hint: 'When your session runs over' },
  { key: NOTIFICATION_TYPES.CARPOOL_BOOKING, label: 'Carpool bookings', hint: 'Seat requests and confirmations' },
  { key: NOTIFICATION_TYPES.CARPOOL_MATCH, label: 'Carpool matches', hint: 'When a driver matches your request' },
  { key: NOTIFICATION_TYPES.ANNOUNCEMENT, label: 'Announcements', hint: 'Site-wide messages from admins' },
];

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);
  const logout = useAuthStore((s) => s.logout);
  const stats = useApi(() => userApi.stats(), []);

  if (!user) return <Spinner />;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile" description="Your account, vehicle, and notification preferences." icon={UserCircle} />

      <StatsCard stats={stats} />
      <ProfileCard user={user} onSaved={patchUser} />
      <PrefsCard user={user} onSaved={patchUser} />
      <PasswordCard />

      <Button variant="ghost" className="mt-6 w-full text-danger" onClick={logout}>
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  );
}

function StatsCard({ stats }) {
  const s = stats.data;
  return (
    <Card className="mb-5">
      <CardHeader title="Your usage" />
      {stats.loading ? (
        <Spinner />
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
      <Icon className="mb-1 h-4 w-4 text-brand" />
      <p className="text-lg font-bold text-content tabular-nums">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function ProfileCard({ user, onSaved }) {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [vehicleDescription, setVehicleDescription] = useState(user.vehicleDescription || '');
  const [parkingSpot, setParkingSpot] = useState(user.parkingSpot || '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setErrors({});
    const parsed = updateProfileSchema.safeParse({
      displayName: displayName.trim(),
      vehicleDescription: vehicleDescription.trim(),
      parkingSpot: parkingSpot.trim(),
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
    <Card className="mb-5">
      <CardHeader title="Account" icon={UserCircle} />
      <div className="space-y-4">
        <Input label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} error={errors.displayName} />
        <Input label="Email" value={user.email} disabled hint="Contact an admin to change your email." />
        <Input label="Vehicle" value={vehicleDescription} onChange={(e) => setVehicleDescription(e.target.value)} error={errors.vehicleDescription} placeholder="Blue Tesla Model 3" />
        <Input label="Usual parking spot" value={parkingSpot} onChange={(e) => setParkingSpot(e.target.value)} error={errors.parkingSpot} placeholder="Level 2, bay 14" />
        <div className="flex justify-end">
          <Button onClick={save} loading={saving}>
            Save changes
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PrefsCard({ user, onSaved }) {
  const [prefs, setPrefs] = useState(user.notificationPrefs || {});
  const [saving, setSaving] = useState(false);

  const isOn = (key) => prefs[key] !== false; // default opted-in
  const toggle = (key) => setPrefs((cur) => ({ ...cur, [key]: !isOn(key) }));

  const save = async () => {
    setSaving(true);
    try {
      const updated = await userApi.updateMe({ notificationPrefs: prefs });
      onSaved(updated);
      toast.success('Preferences saved.');
    } catch (err) {
      toast.error(normalizeError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-5">
      <CardHeader title="Notification preferences" subtitle="Choose what you're alerted about" />
      <ul className="divide-y divide-border">
        {PREF_TOGGLES.map((t) => (
          <li key={t.key} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-medium text-content">{t.label}</p>
              <p className="text-sm text-muted">{t.hint}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isOn(t.key)}
              onClick={() => toggle(t.key)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${isOn(t.key) ? 'bg-brand' : 'bg-surface-2'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${isOn(t.key) ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
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

function PasswordCard() {
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
      <CardHeader title="Change password" icon={KeyRound} />
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
