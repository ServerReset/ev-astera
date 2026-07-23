import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerSchema } from '@shared/validation.js';
import { useAuthStore } from '@/stores/authStore.js';
import { useZodForm } from '@/hooks/useZodForm.js';
import { RedirectIfAuthed } from '@/components/auth/guards.jsx';
import { AuthShell } from './AuthShell.jsx';
import { Input } from '@/components/common/Input.jsx';
import { Button } from '@/components/common/Button.jsx';

export default function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [formError, setFormError] = useState(null);

  const { values, errors, submitting, handleChange, handleSubmit } = useZodForm(registerSchema, {
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    vehicleDescription: '',
  });

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    const res = await register(data);
    if (res.ok) navigate('/', { replace: true });
    else setFormError(res.error?.message || 'Registration failed.');
  });

  return (
    <RedirectIfAuthed>
      <AuthShell
        title="Create your account"
        subtitle="Join the workplace charging & carpool hub"
        footer={
          <>
            Already have an account?{' '}
            <Link to="/login" className="link">
              Sign in
            </Link>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Input
            label="Full name"
            name="displayName"
            autoComplete="name"
            value={values.displayName}
            onChange={handleChange}
            error={errors.displayName}
            placeholder="Alex Rivera"
          />
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
            autoComplete="new-password"
            value={values.password}
            onChange={handleChange}
            error={errors.password}
            hint="8+ chars, upper & lower case, a number, and a symbol"
          />
          <Input
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
          />
          <Input
            label="Vehicle (optional)"
            name="vehicleDescription"
            value={values.vehicleDescription}
            onChange={handleChange}
            error={errors.vehicleDescription}
            placeholder="White Tesla Model 3"
          />
          {formError && <p className="field-error">{formError}</p>}
          <Button type="submit" className="w-full" loading={submitting}>
            Create account
          </Button>
        </form>
      </AuthShell>
    </RedirectIfAuthed>
  );
}
