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
import { Spinner } from '@/components/common/States.jsx';
import { authApi, officeApi } from '@/services/endpoints.js';
import { useRipple } from '@/hooks/useInteractions.js';

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
  const ripple = useRipple();

  // Offices are fetched once, independent of the signup-status gate below (which is per-office
  // and re-fetched whenever the selection changes).
  const [offices, setOffices] = useState({ loading: true, error: false, list: [] });
  useEffect(() => {
    officeApi
      .list()
      .then((list) => setOffices({ loading: false, error: false, list }))
      .catch(() => setOffices({ loading: false, error: true, list: [] }));
  }, []);

  const { values, errors, submitting, setField, handleChange, handleSubmit } = useZodForm(registerSchema, {
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
    setField('locationId', offices.list[0].id);
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
  // `firstGateDone` flips true the first time ANY gate check settles. It gates the full-screen
  // spinner so it shows only on the initial load — a later office switch re-checks in the
  // background with the form still mounted, instead of blanking the page (and the picker) each time.
  const [firstGateDone, setFirstGateDone] = useState(false);
  // Bumped by the inline "Try again" action to re-run the gate check for the current office without
  // needing to switch offices (a transient signup-status failure shouldn't strand the user).
  const [gateRetry, setGateRetry] = useState(0);

  useEffect(() => {
    if (!values.locationId) return undefined;
    // Guard against out-of-order resolution: switching offices fires this again, and a slow
    // earlier response must not overwrite the newer office's gate state. Only the latest run
    // is allowed to commit.
    let ignore = false;
    setGateStatus((s) => ({ ...s, loading: true }));
    authApi
      .signupStatus(values.locationId)
      .then((s) => {
        if (ignore) return;
        setGateStatus({
          loading: false,
          statusError: false,
          releaseAt: s.releaseAt,
          // Fall back to geofenceEnabled if an older server doesn't send geofenceEnforceable.
          geofenceEnforceable: s.geofenceEnforceable ?? s.geofenceEnabled ?? false,
        });
        setFirstGateDone(true);
      })
      .catch(() => {
        if (ignore) return;
        setGateStatus({ loading: false, statusError: true, releaseAt: null, geofenceEnforceable: false });
        setFirstGateDone(true);
      });
    return () => {
      ignore = true;
    };
  }, [values.locationId, gateRetry]);

  const locked = gateStatus.releaseAt && new Date() < new Date(gateStatus.releaseAt);
  // statusError and locked used to take over the whole screen, unmounting the form + office picker.
  // After the office picker was made functional, a transient signup-status failure (or picking a
  // not-yet-open office) on a background re-check would destroy typed input and trap the user (the
  // gate effect only reruns on office change, but the picker was gone). Both are now surfaced INLINE
  // above the still-mounted form, so the user can switch offices, retry, or keep their input.
  const submitBlocked = gateStatus.loading || gateStatus.statusError || locked;

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    setGeoError(null);

    // A background gate re-check (after an office switch) is still in flight — the geofence/lock
    // state we'd act on may be for the previous office. Wait for it to settle rather than submit
    // against stale gate data. Also refuse when the gate is unknown (status check failed) or the
    // office isn't open yet — these are surfaced inline above and the button is disabled, but guard
    // here too so a keyboard Enter can't bypass it.
    if (gateStatus.loading) {
      setFormError('Just checking this office — one moment, then try again.');
      return;
    }
    if (gateStatus.statusError) {
      setFormError("We can't confirm signups are open for this office yet. Tap Try again above, or pick another office.");
      return;
    }
    if (locked) {
      setFormError('Signups for this office are not open yet. Pick another office if you are joining a different site.');
      return;
    }

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

  // Check error/empty states BEFORE the loading guard — otherwise a failed or empty offices load
  // (where values.locationId never gets set) would fall into the old `return null` and render a
  // permanently blank page instead of a message the user can act on.
  if (offices.error) {
    return (
      <RedirectIfAuthed>
        <AuthShell title="Can't load offices" subtitle="Try again in a moment">
          <div className="flex flex-col items-center gap-3 py-2 text-center animate-scale-in">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-danger/10 text-danger animate-pop-in">
              <WifiOff className="h-7 w-7" />
            </span>
            <p className="text-sm text-muted">We couldn't reach the server to list offices. Reload the page to try again.</p>
          </div>
        </AuthShell>
      </RedirectIfAuthed>
    );
  }

  if (!offices.loading && offices.list.length === 0) {
    return (
      <RedirectIfAuthed>
        <AuthShell title="No offices available" subtitle="Signups aren't set up yet">
          <div className="flex flex-col items-center gap-3 py-2 text-center animate-scale-in">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-faint animate-float">
              <WifiOff className="h-7 w-7" />
            </span>
            <p className="text-sm text-muted">There are no offices open for registration right now. Contact an admin.</p>
          </div>
        </AuthShell>
      </RedirectIfAuthed>
    );
  }

  // Still loading offices, or waiting for the default office to seed / the FIRST gate check to
  // finish — show a spinner inside the shell, never a blank screen. Subsequent office switches
  // re-check in the background (firstGateDone stays true), so the form + picker never blank out.
  if (offices.loading || !values.locationId || (gateStatus.loading && !firstGateDone)) {
    return (
      <RedirectIfAuthed>
        <AuthShell title="Create your account" subtitle="Join the workplace charging & carpool hub">
          <Spinner label="Loading…" />
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
          {/* Inline gate states — never a full-screen takeover, so the office picker + typed input
              stay put. A failed status check offers a retry; a not-yet-open office shows when it
              opens. Both let the user switch to a different office right below. */}
          {gateStatus.statusError && (
            <div className="flex items-start gap-2 rounded-2xl bg-danger/10 p-3 text-sm text-danger animate-pop-in">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">
                Couldn't check whether signups are open for this office.{' '}
                <button type="button" onClick={() => setGateRetry((n) => n + 1)} className="link font-semibold">
                  Try again
                </button>
                , or pick another office below.
              </span>
            </div>
          )}
          {!gateStatus.statusError && locked && (
            <p className="flex items-start gap-2 rounded-2xl bg-brand/10 p-3 text-sm text-brand-strong animate-pop-in">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Signups for this office open at{' '}
                <span className="font-semibold text-content">{new Date(gateStatus.releaseAt).toLocaleString()}</span>.
                Choose another office below if you're joining a different site.
              </span>
            </p>
          )}
          {/* Tell users up front that this office verifies on-site location, so the browser's
              permission prompt on submit isn't a surprise (and they know to be on-site). */}
          {!submitBlocked && gateStatus.geofenceEnforceable && (
            <p className="flex items-start gap-2 rounded-2xl bg-info/10 p-3 text-sm text-info animate-slide-up [animation-fill-mode:backwards]">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 animate-float" />
              <span>
                This office verifies that you’re on-site. When you tap Create account, your browser
                will ask to share your location.
              </span>
            </p>
          )}
          <div className="animate-slide-up [animation-fill-mode:backwards] [animation-delay:40ms]">
            <Select
              label="Office"
              name="locationId"
              value={values.locationId}
              // GlassSelect emits a synthetic { target: { value } } with no `name`, so
              // handleChange (which keys off e.target.name) would write to values[undefined] and
              // the pick would never stick. Set the field explicitly instead.
              onChange={(e) => setField('locationId', e.target.value)}
              error={errors.locationId}
              options={offices.list.map((o) => ({ value: o.id, label: o.name }))}
            />
          </div>
          <div className="animate-slide-up [animation-fill-mode:backwards] [animation-delay:90ms]">
            <Input
              label="Full name"
              name="displayName"
              autoComplete="name"
              value={values.displayName}
              onChange={handleChange}
              error={errors.displayName}
              placeholder="Alex Rivera"
            />
          </div>
          <div className="animate-slide-up [animation-fill-mode:backwards] [animation-delay:140ms]">
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
          </div>
          <div className="animate-slide-up [animation-fill-mode:backwards] [animation-delay:190ms]">
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
          </div>
          <div className="animate-slide-up [animation-fill-mode:backwards] [animation-delay:240ms]">
            <Input
              label="Confirm password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={handleChange}
              error={errors.confirmPassword}
            />
          </div>
          <div className="animate-slide-up [animation-fill-mode:backwards] [animation-delay:290ms]">
            <Input
              label="Vehicle"
              name="vehicleDescription"
              value={values.vehicleDescription}
              onChange={handleChange}
              error={errors.vehicleDescription}
              placeholder="White Tesla Model 3"
            />
          </div>
          {geoError && (
            <p className="field-error flex items-start gap-1.5 animate-pop-in">
              <MapPinOff className="mt-0.5 h-4 w-4 shrink-0" />
              {geoError}
            </p>
          )}
          {formError && <p className="field-error animate-pop-in">{formError}</p>}
          <div className="animate-slide-up [animation-fill-mode:backwards] [animation-delay:340ms]">
            <Button
              type="submit"
              className="w-full press sheen ripple hover-sheen"
              loading={submitting || locating || gateStatus.loading}
              disabled={gateStatus.statusError || locked}
              onPointerDown={ripple}
            >
              {locating
                ? 'Checking your location…'
                : gateStatus.loading
                  ? 'Checking this office…'
                  : locked
                    ? 'Signups not open yet'
                    : gateStatus.statusError
                      ? 'Signups status unavailable'
                      : 'Create account'}
            </Button>
          </div>
        </form>
      </AuthShell>
    </RedirectIfAuthed>
  );
}
