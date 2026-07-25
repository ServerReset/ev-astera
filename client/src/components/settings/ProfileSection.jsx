import { Trophy, ChevronRight, LogOut, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Input, Textarea } from '@/components/common/Input.jsx';
import { Spinner, ErrorState } from '@/components/common/States.jsx';
import { useApi } from '@/hooks/useApi.js';
import { useZodForm } from '@/hooks/useZodForm.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { useAuthStore } from '@/stores/authStore.js';
import { userApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { updateProfileSchema } from '@shared/validation.js';
import { UsageStatsCard } from './UsageStatsCard.jsx';

/** Editable name + vehicle, saved via userApi.updateMe → authStore.patchUser. */
function ProfileForm() {
  const user = useAuthStore((s) => s.user);
  const patchUser = useAuthStore((s) => s.patchUser);
  const ripple = useRipple();
  const form = useZodForm(updateProfileSchema, {
    displayName: user?.displayName || '',
    vehicleDescription: user?.vehicleDescription || '',
  });

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      const updated = await userApi.updateMe({
        displayName: data.displayName,
        vehicleDescription: data.vehicleDescription || '',
      });
      patchUser(updated);
      toast.success('Profile updated');
    } catch (err) {
      const e = normalizeError(err);
      if (e.details) form.setServerErrors(e.details);
      toast.error(e.message || 'Could not save your profile');
    }
  });

  const dirty =
    form.values.displayName !== (user?.displayName || '') ||
    (form.values.vehicleDescription || '') !== (user?.vehicleDescription || '');

  return (
    <Card>
      <CardHeader title="Your details" subtitle="How you appear to others at your site." icon={UserRound} />
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Input
          label="Display name"
          name="displayName"
          value={form.values.displayName}
          onChange={form.handleChange}
          error={form.errors.displayName}
          maxLength={60}
          autoComplete="name"
        />
        <Textarea
          label="Vehicle"
          name="vehicleDescription"
          value={form.values.vehicleDescription}
          onChange={form.handleChange}
          error={form.errors.vehicleDescription}
          hint="Shown on your charging session so people know whose car is plugged in."
          rows={2}
          maxLength={120}
        />
        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" size="sm" className="press ripple" onPointerDown={ripple} loading={form.submitting} disabled={!dirty}>
            Save changes
          </Button>
          {user?.email && <span className="text-xs text-faint">{user.email}</span>}
        </div>
      </form>
    </Card>
  );
}

export function ProfileSection() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const ripple = useRipple();
  const stats = useApi(() => userApi.stats(), []);

  return (
    <div className="flex flex-col gap-4">
      {stats.loading && !stats.data ? (
        <div className="skeleton h-56 rounded-xl-increased" />
      ) : stats.error ? (
        <ErrorState error={stats.error} onRetry={stats.refetch} title="Could not load your stats" />
      ) : (
        <UsageStatsCard stats={stats.data} />
      )}

      {/* Link to achievements */}
      <Card
        as="button"
        onClick={() => navigate('/achievements')}
        className="card-interactive hover-sheen ripple flex w-full items-center gap-3 text-left"
        onPointerDown={ripple}
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-warning/15 text-warning">
          <Trophy className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-content">Achievements</p>
          <p className="text-sm text-muted">Badges you've unlocked and what's next.</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-faint" />
      </Card>

      <ProfileForm />

      <div className="pt-1">
        <Button variant="ghost" className="press ripple text-danger" onPointerDown={ripple} onClick={logout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
