import { Navigate } from 'react-router-dom';

/**
 * Dead route, kept only because this environment has no shell access to delete the file.
 * The token-based reset flow was removed (no outbound email in this deployment — see
 * ForgotPasswordPage.jsx). Not imported or routed in App.jsx; this redirect is a safety net
 * in case something still links here directly.
 */
export default function ResetPasswordPage() {
  return <Navigate to="/forgot-password" replace />;
}
