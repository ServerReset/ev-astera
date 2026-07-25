import { Link } from 'react-router-dom';
import { ShieldQuestion } from 'lucide-react';
import { AuthShell } from './AuthShell.jsx';

/**
 * There's no outbound email in this deployment, so self-service reset isn't possible — a
 * locked-out user has to ask an admin, who can set a temp password from Admin → Users.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Reset it with your site admin"
      footer={
        <Link to="/login" className="link">
          Back to sign in
        </Link>
      }
    >
      <div className="flex flex-col items-center gap-4 py-2 text-center animate-scale-in">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand/15 text-brand-strong shadow-elevation-1 animate-glow">
          <ShieldQuestion className="h-8 w-8 animate-float" />
        </span>
        <p className="text-sm text-muted animate-slide-up [animation-fill-mode:backwards] [animation-delay:100ms]">
          This site doesn't send reset emails. Ask an admin at your location to reset your password
          from Admin → Users — they'll set a temporary one and share it with you directly.
        </p>
      </div>
    </AuthShell>
  );
}
