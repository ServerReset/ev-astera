import { useEffect, useMemo, useRef } from 'react';
import { KeyRound, ShieldCheck, Check } from 'lucide-react';
import { Card, CardHeader } from '@/components/common/Card.jsx';
import { Button } from '@/components/common/Button.jsx';
import { Input } from '@/components/common/Input.jsx';
import { useZodForm } from '@/hooks/useZodForm.js';
import { useRipple } from '@/hooks/useInteractions.js';
import { userApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { toast } from '@/stores/toastStore.js';
import { burstConfetti } from '@/utils/confetti.js';
import { changePasswordSchema } from '@shared/validation.js';
import { cn } from '@/utils/cn.js';

// Mirrors the passwordSchema rules so the user sees live progress as they type.
const RULES = [
  { label: '8+ characters', test: (v) => v.length >= 8 },
  { label: 'Uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'Lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'A number', test: (v) => /[0-9]/.test(v) },
  { label: 'A special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export function SecuritySection() {
  const ripple = useRipple();
  const form = useZodForm(changePasswordSchema, {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const checks = useMemo(() => {
    const v = form.values.newPassword || '';
    return RULES.map((r) => ({ ...r, ok: r.test(v) }));
  }, [form.values.newPassword]);

  const allOk = checks.every((c) => c.ok);
  const listRef = useRef(null);
  const wasAllOk = useRef(false);

  // Tiny win moment: the instant every rule turns green, a small burst from the checklist.
  // Guarded so it fires once on the false→true edge, never on every keystroke afterwards.
  useEffect(() => {
    if (allOk && !wasAllOk.current) {
      const el = listRef.current;
      if (el) {
        const r = el.getBoundingClientRect();
        burstConfetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 32 });
      }
    }
    wasAllOk.current = allOk;
  }, [allOk]);

  const onSubmit = form.handleSubmit(async (data) => {
    try {
      await userApi.changePassword(data);
      form.setValues({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('New password locked in. Nicely done.');
    } catch (err) {
      const e = normalizeError(err);
      if (e.details) form.setServerErrors(e.details);
      toast.error(e.message || "Your password wasn't changed — the server didn't say why. Check your current password is correct, then try again.");
    }
  });

  return (
    <Card>
      <CardHeader title="Password" subtitle="Update the password you use to sign in." icon={KeyRound} />
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Input
          label="Current password"
          type="password"
          name="currentPassword"
          value={form.values.currentPassword}
          onChange={form.handleChange}
          error={form.errors.currentPassword}
          autoComplete="current-password"
        />
        <Input
          label="New password"
          type="password"
          name="newPassword"
          value={form.values.newPassword}
          onChange={form.handleChange}
          error={form.errors.newPassword}
          autoComplete="new-password"
        />

        {/* Live strength checklist */}
        {form.values.newPassword?.length > 0 && (
          <ul
            ref={listRef}
            className={cn(
              'grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-2xl p-3 transition-colors duration-medium',
              allOk ? 'bg-success/10 ring-1 ring-success/30' : 'bg-surface-2/60'
            )}
          >
            {checks.map((c) => (
              <li
                key={c.label}
                className={cn('flex items-center gap-1.5 text-xs transition-colors duration-medium', c.ok ? 'text-success' : 'text-faint')}
              >
                <span
                  className={cn(
                    'grid h-4 w-4 shrink-0 place-items-center rounded-full transition-all duration-medium ease-spring',
                    c.ok ? 'bg-success/20 scale-100' : 'bg-surface-2 scale-90'
                  )}
                >
                  <Check className={cn('h-3 w-3', c.ok ? 'opacity-100' : 'opacity-30')} />
                </span>
                {c.label}
              </li>
            ))}
          </ul>
        )}

        <Input
          label="Confirm new password"
          type="password"
          name="confirmPassword"
          value={form.values.confirmPassword}
          onChange={form.handleChange}
          error={form.errors.confirmPassword}
          autoComplete="new-password"
        />
        <div className="pt-1">
          <Button type="submit" size="sm" className="press ripple" onPointerDown={ripple} loading={form.submitting}>
            <ShieldCheck className="h-4 w-4" />
            Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}
