import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore.js';
import { Spinner } from '@/components/common/States.jsx';
import { ROLES } from '@/utils/constants.js';

/** Gate for authenticated routes. Redirects to /login (preserving intended path). */
export function RequireAuth({ children }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <Spinner label="Loading your hub…" />
      </div>
    );
  }
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}

/** Gate for admin-only routes. Sends non-admins home. */
export function RequireAdmin({ children }) {
  const role = useAuthStore((s) => s.user?.role);
  if (role !== ROLES.ADMIN) return <Navigate to="/" replace />;
  return children;
}

/** For /login and /register: if already authenticated, bounce to the dashboard. */
export function RedirectIfAuthed({ children }) {
  const status = useAuthStore((s) => s.status);
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return children;
}
