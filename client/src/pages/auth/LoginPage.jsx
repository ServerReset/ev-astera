import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { loginSchema } from '@shared/validation.js';
import { useAuthStore } from '@/stores/authStore.js';
import { useZodForm } from '@/hooks/useZodForm.js';
import { RedirectIfAuthed } from '@/components/auth/guards.jsx';
import { AuthShell } from './AuthShell.jsx';
import { WelcomeDialog } from '@/components/auth/WelcomeDialog.jsx';
import { Input } from '@/components/common/Input.jsx';
import { Button } from '@/components/common/Button.jsx';
import { useRipple } from '@/hooks/useInteractions.js';

export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState(null);
  const ripple = useRipple();
  const from = location.state?.from?.pathname || '/';

  const { values, errors, submitting, handleChange, handleSubmit } = useZodForm(loginSchema, {
    email: '',
    password: '',
    rememberMe: false,
  });

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    const res = await login(data);
    if (res.ok) navigate(from, { replace: true });
    else setFormError(res.error?.message || 'Login failed.');
  });

  return (
    <RedirectIfAuthed>
      {/* First-time visitors get a one-off welcome explaining they need an Astera-email account. */}
      <WelcomeDialog />
      <AuthShell
        title="Welcome back"
        subtitle="Sign in to manage your charging & carpools"
        footer={
          <>
            New here?{' '}
            <Link to="/register" className="link">
              Create an account
            </Link>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="animate-slide-up [animation-fill-mode:backwards] [animation-delay:60ms]">
            <Input
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={handleChange}
              error={errors.email}
              placeholder="you@asteralabs.com"
            />
          </div>
          <div className="animate-slide-up [animation-fill-mode:backwards] [animation-delay:120ms]">
            <Input
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={values.password}
              onChange={handleChange}
              error={errors.password}
              placeholder="••••••••"
            />
          </div>
          <div className="flex items-center justify-between animate-slide-up [animation-fill-mode:backwards] [animation-delay:180ms]">
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                name="rememberMe"
                checked={values.rememberMe}
                onChange={handleChange}
                className="h-4 w-4 rounded-md border-border bg-bg-elevated text-brand focus:ring-brand"
              />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-sm link">
              Forgot password?
            </Link>
          </div>
          {formError && <p className="field-error animate-pop-in">{formError}</p>}
          <div className="animate-slide-up [animation-fill-mode:backwards] [animation-delay:240ms]">
            <Button
              type="submit"
              className="w-full press sheen ripple hover-sheen"
              loading={submitting}
              onPointerDown={ripple}
            >
              Sign in
            </Button>
          </div>
        </form>
      </AuthShell>
    </RedirectIfAuthed>
  );
}
