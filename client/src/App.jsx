import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore.js';
import { AppLayout } from '@/components/layout/AppLayout.jsx';
import { RequireAuth } from '@/components/auth/guards.jsx';
import { Toaster } from '@/components/common/Toaster.jsx';
import LoginPage from '@/pages/auth/LoginPage.jsx';
import RegisterPage from '@/pages/auth/RegisterPage.jsx';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage.jsx';

/**
 * Root component. The feature UI has been stripped down to the floating-nav-bar shell: the module
 * registry is empty, so there are no page routes left. Public auth routes still exist (you have to
 * sign in to reach the shell); every other path renders the authenticated shell (aurora + floating
 * bar) via RequireAuth → AppLayout. Restoring the full app = re-populate modules/registry.js and
 * bring back the route mapping (see git history).
 */
export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  return (
    <>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Everything else: the authenticated shell (floating bar + aurora, no page content). */}
        <Route
          path="*"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        />
      </Routes>
      <Toaster />
    </>
  );
}
