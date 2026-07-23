import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { loginSchema } from '@shared/validation.js';
import { useAuthStore } from '@/stores/authStore.js';
import { useZodForm } from '@/hooks/useZodForm.js';
import { RedirectIfAuthed } from '@/components/auth/guards.jsx';
import { AuthShell } from './AuthShell.jsx';
import { Input } from '@/components/common/Input.jsx';
import { Button } from '@/components/common/Button.jsx';

export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState(null);
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
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                name="rememberMe"
                checked={values.rememberMe}
                onChange={handleChange}
                className="h-4 w-4 rounded border-border bg-bg-elevated text-brand focus:ring-brand"
              />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-sm link">
              Forgot password?
            </Link>
          </div>
          {formError && <p className="field-error">{formError}</p>}
          <Button type="submit" className="w-full" loading={submitting}>
            Sign in
          </Button>
        </form>
      </AuthShell>
    </RedirectIfAuthed>
  );
}
