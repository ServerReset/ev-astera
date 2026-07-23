import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPasswordSchema } from '@shared/validation.js';
import { authApi } from '@/services/endpoints.js';
import { normalizeError } from '@/services/api.js';
import { useZodForm } from '@/hooks/useZodForm.js';
import { AuthShell } from './AuthShell.jsx';
import { Input } from '@/components/common/Input.jsx';
import { Button } from '@/components/common/Button.jsx';
import { toast } from '@/stores/toastStore.js';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const [formError, setFormError] = useState(null);

  const { values, errors, submitting, handleChange, handleSubmit } = useZodForm(resetPasswordSchema, {
    token,
    password: '',
  });

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    try {
      await authApi.resetPassword(data.token, data.password);
      toast.success('Password updated. You can sign in now.');
      navigate('/login', { replace: true });
    } catch (err) {
      setFormError(normalizeError(err).message);
    }
  });

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you don't use elsewhere">
      {!token ? (
        <div className="text-center text-sm text-muted">
          This reset link is missing its token.{' '}
          <Link to="/forgot-password" className="link">
            Request a new one
          </Link>
          .
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <Input
            label="New password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={handleChange}
            error={errors.password}
            hint="8+ chars, upper & lower case, a number, and a symbol"
          />
          {formError && <p className="field-error">{formError}</p>}
          <Button type="submit" className="w-full" loading={submitting}>
            Update password
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
