import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock3, MapPin, MapPinOff, WifiOff } from 'lucide-react';
import { registerSchema } from '@shared/validation.js';
import { useAuthStore } from '@/stores/authStore.js';
import { useZodForm } from '@/hooks/useZodForm.js';
import { RedirectIfAuthed } from '@/components/auth/guards.jsx';
import { AuthShell } from './AuthShell.jsx';
import { Input, Select } from '@/components/common/Input.jsx';
import { Button } from '@/components/common/Button.jsx';
import { authApi, officeApi } from '@/services/endpoints.js';

/** Wraps navigator.geolocation in a promise with the real-world failure modes named. */
function getLocation() {
  return new Promise((resolve, reject) => {
    // Geolocation only works in a secure context (HTTPS, or localhost). Over plain http on a LAN
    // IP the API exists but getCurrentPosition fails with an opaque error — detect it up front so
    // we can tell the user the real reason instead of a generic "couldn't determine your location".
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      reject({ code: 'insecure' });
      return;
    }
    if (!navigator.geolocation) {
      reject({ code: 'unsupported' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject({ code: err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'error' }),
      { timeout: 10_000, enableHighAccuracy: true }
    );
  });
}

const GEO_ERROR_COPY = {
  denied: 'Location access is required to register, and this office verifies you’re on-site. Allow location for this site in your browser, then tap Try again.',
  timeout: 'Location request timed out — this can happen indoors. Tap Try again.',
  unsupported: 'This browser can’t share your location, which is required to register here. Try a different browser or device while on-site.',
  insecure: 'Your location can’t be read over an insecure connection. Open this site over https:// (or contact an admin) and try again.',
  error: 'We couldn’t determine your location. Make sure location is on, then tap Try again.',
};

export default function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [formError, setFormError] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [locating, setLocating] = useState(false);

  // Offices are fetched once, independent of the signup-status gate below (which is per-office
  // and re-fetched whenever the selection changes).
  const [offices, setOffices] = useState({ loading: true, error: false, list: [] });
  useEffect(() => {
    officeApi
      .list()
      .then((list) => setOffices({ loading: false, error: false, list }))
      .catch(() => setOffices({ loading: false, error: true, list: [] }));
  }, []);

  const { values, errors, submitting, handleChange, handleSubmit } = useZodForm(registerSchema, {
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    vehicleDescription: '',
    locationId: '',
  });

  // Default to the first office once the list loads, so the signup-status fetch below has
  // something to gate on without the user having to touch the picker first.
  useEffect(() => {
    if (values.locationId || offices.list.length === 0) return;
    handleChange({ target: { name: 'locationId', value: offices.list[0].id, type: 'text' } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offices.list]);

  // `statusError: true` is its own conservative branch (not folded into `releaseAt`/
  // `geofenceEnabled`) — a failed status check should never quietly render as "signups are
  // open," which is what defaulting releaseAt to null used to do even though geofenceEnabled
  // defaulted to the safe `true`. Fail closed consistently for both gates instead.
  // `geofenceEnforceable` reflects whether the office can ACTUALLY enforce location (geofence on
  // AND the office has coordinates). We prompt for the browser location only when it's enforceable
  // — an office with geofence on but no coords shouldn't make people grant location for nothing.
  const [gateStatus, setGateStatus] = useState({ loading: true, statusError: false, releaseAt: null, geofenceEnforceable: false });

  useEffect(() => {
    if (!values.locationId) return;
    setGateStatus((s) => ({ ...s, loading: true }));
    authApi
      .signupStatus(values.locationId)
      .then((s) =>
        setGateStatus({
          loading: false,
          statusError: false,
          releaseAt: s.releaseAt,
          // Fall back to geofenceEnabled if an older server doesn't send geofenceEnforceable.
          geofenceEnforceable: s.geofenceEnforceable ?? s.geofenceEnabled ?? false,
        })
      )
      .catch(() => setGateStatus({ loading: false, statusError: true, releaseAt: null, geofenceEnforceable: false }));
  }, [values.locationId]);

  const locked = gateStatus.releaseAt && new Date() < new Date(gateStatus.releaseAt);

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    setGeoError(null);

    let coords = {};
    if (gateStatus.geofenceEnforceable) {
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

  if (offices.loading || !values.locationId) return null;

  if (offices.error) {
    return (
      <RedirectIfAuthed>
        <AuthShell title="Can't load offices" subtitle="Try again in a moment">
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <WifiOff className="h-10 w-10 text-danger" />
            <p className="text-sm text-muted">We couldn't reach the server to list offices. Reload the page to try again.</p>
          </div>
        </AuthShell>
      </RedirectIfAuthed>
    );
  }

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
          {/* Tell users up front that this office verifies on-site location, so the browser's
              permission prompt on submit isn't a surprise (and they know to be on-site). */}
          {gateStatus.geofenceEnforceable && (
            <p className="flex items-start gap-2 rounded-2xl bg-info/10 p-3 text-sm text-info">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This office verifies that you’re on-site. When you tap Create account, your browser
                will ask to share your location.
              </span>
            </p>
          )}
          <Select
            label="Office"
            name="locationId"
            value={values.locationId}
            onChange={handleChange}
            error={errors.locationId}
            options={offices.list.map((o) => ({ value: o.id, label: o.name }))}
          />
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
