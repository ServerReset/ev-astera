import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore.js';
import { allRoutes } from '@/modules/registry.js';
import { AppLayout } from '@/components/layout/AppLayout.jsx';
import { RequireAuth, RequireAdmin } from '@/components/auth/guards.jsx';
import { Toaster } from '@/components/common/Toaster.jsx';
import LoginPage from '@/pages/auth/LoginPage.jsx';
import RegisterPage from '@/pages/auth/RegisterPage.jsx';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage.jsx';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage.jsx';
import NotFoundPage from '@/pages/NotFoundPage.jsx';

/**
 * Root component. Restores the session on mount, then renders public auth routes and the
 * authenticated app shell. App routes come from the module registry so adding a feature
 * needs no change here — only a new module manifest.
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
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Authenticated shell */}
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          {allRoutes.map(({ path, element: Element, roles }) => (
            <Route
              key={path}
              path={path}
              element={roles?.includes('admin') ? <RequireAdmin><Element /></RequireAdmin> : <Element />}
            />
          ))}
        </Route>

        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
      <Toaster />
    </>
  );
}
