import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema } from '@shared/validation.js';
import { authApi } from '@/services/endpoints.js';
import { useZodForm } from '@/hooks/useZodForm.js';
import { AuthShell } from './AuthShell.jsx';
import { Input } from '@/components/common/Input.jsx';
import { Button } from '@/components/common/Button.jsx';
import { CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const { values, errors, submitting, handleChange, handleSubmit } = useZodForm(forgotPasswordSchema, { email: '' });

  const onSubmit = handleSubmit(async (data) => {
    // Server always returns a generic message (no user enumeration); we mirror that here.
    await authApi.forgotPassword(data.email).catch(() => {});
    setSent(true);
  });

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll email you a reset link"
      footer={
        <Link to="/login" className="link">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <CheckCircle2 className="h-10 w-10 text-success" />
          <p className="text-sm text-muted">
            If an account exists for that email, a reset link is on its way. Check your inbox.
          </p>
        </div>
      ) : (
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
          <Button type="submit" className="w-full" loading={submitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
