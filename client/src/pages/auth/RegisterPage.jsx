import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock3, MapPinOff, WifiOff } from 'lucide-react';
import { registerSchema } from '@shared/validation.js';
import { useAuthStore } from '@/stores/authStore.js';
import { useZodForm } from '@/hooks/useZodForm.js';
import { RedirectIfAuthed } from '@/components/auth/guards.jsx';
import { AuthShell } from './AuthShell.jsx';
import { Input } from '@/components/common/Input.jsx';
import { Button } from '@/components/common/Button.jsx';
import { authApi } from '@/services/endpoints.js';

/** Wraps navigator.geolocation in a promise with the three real-world failure modes named. */
function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ code: 'unsupported' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject({ code: err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'error' }),
      { timeout: 10_000 }
    );
  });
}

const GEO_ERROR_COPY = {
  denied: "Location access is required to register from this device. Enable location permissions in your browser and try again.",
  timeout: 'Location request timed out. Try again.',
  unsupported: 'Registration requires a browser that supports location access.',
  error: "Couldn't determine your location. Try again.",
};

export default function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [formError, setFormError] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [locating, setLocating] = useState(false);
  // `statusError: true` is its own conservative branch (not folded into `releaseAt`/
  // `geofenceEnabled`) — a failed status check should never quietly render as "signups are
  // open," which is what defaulting releaseAt to null used to do even though geofenceEnabled
  // defaulted to the safe `true`. Fail closed consistently for both gates instead.
  const [gateStatus, setGateStatus] = useState({ loading: true, statusError: false, releaseAt: null, geofenceEnabled: true });

  useEffect(() => {
    authApi
      .signupStatus()
      .then((s) => setGateStatus({ loading: false, statusError: false, releaseAt: s.releaseAt, geofenceEnabled: s.geofenceEnabled }))
      .catch(() => setGateStatus({ loading: false, statusError: true, releaseAt: null, geofenceEnabled: true }));
  }, []);

  const { values, errors, submitting, handleChange, handleSubmit } = useZodForm(registerSchema, {
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    vehicleDescription: '',
  });

  const locked = gateStatus.releaseAt && new Date() < new Date(gateStatus.releaseAt);

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    setGeoError(null);

    let coords = {};
    if (gateStatus.geofenceEnabled) {
      setLocating(true);
      try {
        coords = await getLocation();
      } catch (err) {
        setLocating(false);
        setGeoError(GEO_ERROR_COPY[err.code] || GEO_ERROR_COPY.error);
        return;
      }
      setLocating(false);
    }

    const res = await register({ ...data, ...coords });
    if (res.ok) navigate('/', { replace: true });
    else setFormError(res.error?.message || 'Registration failed.');
  });

  if (gateStatus.loading) return null;

  if (gateStatus.statusError) {
    return (
      <RedirectIfAuthed>
        <AuthShell title="Can't check registration status" subtitle="Try again in a moment">
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <WifiOff className="h-10 w-10 text-danger" />
            <p className="text-sm text-muted">
              We couldn't reach the server to check whether signups are open. Reload the page to try again.
            </p>
          </div>
        </AuthShell>
      </RedirectIfAuthed>
    );
  }

  if (locked) {
    return (
      <RedirectIfAuthed>
        <AuthShell
          title="Signups aren't open yet"
          subtitle="Check back soon"
          footer={
            <>
              Already have an account?{' '}
              <Link to="/login" className="link">
                Sign in
              </Link>
            </>
          }
        >
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <Clock3 className="h-10 w-10 text-brand-strong" />
            <p className="text-sm text-muted">
              Registration opens at {new Date(gateStatus.releaseAt).toLocaleString()}.
            </p>
          </div>
        </AuthShell>
      </RedirectIfAuthed>
    );
  }

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
            label="Vehicle"
            name="vehicleDescription"
            value={values.vehicleDescription}
            onChange={handleChange}
            error={errors.vehicleDescription}
            placeholder="White Tesla Model 3"
          />
          {geoError && (
            <p className="field-error flex items-start gap-1.5">
              <MapPinOff className="mt-0.5 h-4 w-4 shrink-0" />
              {geoError}
            </p>
          )}
          {formError && <p className="field-error">{formError}</p>}
          <Button type="submit" className="w-full" loading={submitting || locating}>
            {locating ? 'Checking your location…' : 'Create account'}
          </Button>
        </form>
      </AuthShell>
    </RedirectIfAuthed>
  );
}
