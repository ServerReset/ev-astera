/**
 * Time/format helpers. Every function resolves its timezone via resolveTz() rather than a
 * hardcoded constant, so wall-clock times always read in the RELEVANT office's local time —
 * the super-admin's currently-selected office when viewing one (AdminPage's switcher), otherwise
 * the logged-in user's own home office — regardless of the viewing device's own timezone.
 */
import { formatInTimeZone } from 'date-fns-tz';
import { TIMEZONE } from '@shared/constants.js';
import { useAuthStore } from '@/stores/authStore.js';
import { useOfficeStore } from '@/stores/officeStore.js';

const toDate = (v) => (v instanceof Date ? v : new Date(v));

/** Resolution order: explicit `tz` arg (rare — cross-office comparisons) > super-admin's
 * selected office > the viewer's own office > the hardcoded fallback (pre-login safety net). */
function resolveTz(explicitTz) {
  if (explicitTz) return explicitTz;
  const { selectedOfficeId, tzFor } = useOfficeStore.getState();
  if (selectedOfficeId) {
    const tz = tzFor(selectedOfficeId);
    if (tz) return tz;
  }
  return useAuthStore.getState().user?.office?.timezone || TIMEZONE;
}

/** e.g. "2:45 PM" */
export function formatTime(value, tz) {
  if (!value) return '';
  return formatInTimeZone(toDate(value), resolveTz(tz), 'h:mm a');
}

/** e.g. "Mon, Jul 22 · 2:45 PM" */
export function formatDateTime(value, tz) {
  if (!value) return '';
  return formatInTimeZone(toDate(value), resolveTz(tz), "EEE, MMM d · h:mm a");
}

/** e.g. "Jul 22" */
export function formatDate(value, tz) {
  if (!value) return '';
  return formatInTimeZone(toDate(value), resolveTz(tz), 'MMM d');
}

/** Value for a datetime-local input, expressed in the resolved office's timezone. */
export function toLocalInputValue(value, tz) {
  const d = value ? toDate(value) : new Date();
  return formatInTimeZone(d, resolveTz(tz), "yyyy-MM-dd'T'HH:mm");
}

/**
 * Convert a `datetime-local` string (which the browser interprets as wall-clock in the
 * user's zone) into an ISO instant, treating the entered wall-clock as the resolved office's
 * local time — e.g. "8:00 AM" typed at the Tokyo office produces a UTC instant that's actually
 * 8am Tokyo time, not 8am wherever the hardcoded fallback used to point.
 */
export function localInputToISO(localValue, tz) {
  if (!localValue) return null;
  const zone = resolveTz(tz);
  // Reconstruct the instant: the string has no zone; anchor it to the resolved zone by
  // computing the offset for that wall-clock date.
  const [datePart, timePart] = localValue.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi] = timePart.split(':').map(Number);
  // Build a UTC guess, then correct by the resolved zone's offset at that moment.
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const offsetLabel = formatInTimeZone(guess, zone, 'xxx'); // e.g. -07:00
  const sign = offsetLabel.startsWith('-') ? 1 : -1;
  const [offH, offM] = offsetLabel.slice(1).split(':').map(Number);
  const corrected = new Date(guess.getTime() + sign * (offH * 60 + offM) * 60000);
  return corrected.toISOString();
}

/** Milliseconds until a future ISO instant (clamped at 0). */
export function msUntil(value) {
  if (!value) return 0;
  return Math.max(0, toDate(value).getTime() - Date.now());
}

/** Milliseconds elapsed since a past ISO instant (clamped at 0). */
export function msSince(value) {
  if (!value) return 0;
  return Math.max(0, Date.now() - toDate(value).getTime());
}

/** "mm:ss" from a millisecond duration. */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** "1h 20m" style compact duration from minutes. */
export function formatDurationMinutes(mins) {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h && rem) return `${h}h ${rem}m`;
  if (h) return `${h}h`;
  return `${rem}m`;
}

/** Human relative time, e.g. "in 12m", "3m ago". */
export function relativeTime(value) {
  const diffMs = toDate(value).getTime() - Date.now();
  const past = diffMs < 0;
  const mins = Math.round(Math.abs(diffMs) / 60000);
  let text;
  if (mins < 1) text = 'now';
  else if (mins < 60) text = `${mins}m`;
  else if (mins < 1440) text = `${Math.round(mins / 60)}h`;
  else text = `${Math.round(mins / 1440)}d`;
  if (text === 'now') return 'just now';
  return past ? `${text} ago` : `in ${text}`;
}
