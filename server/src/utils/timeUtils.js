/** Server-side time helpers. All storage is UTC; display formatting is done client-side. */
import { TIMEZONE } from '../../../shared/constants.js';

export const now = () => new Date();

export const addMinutes = (date, minutes) => new Date(new Date(date).getTime() + minutes * 60_000);
export const addHours = (date, hours) => addMinutes(date, hours * 60);
export const addDays = (date, days) => new Date(new Date(date).getTime() + days * 86_400_000);

/** Whole-minute difference b - a (can be negative). */
export const diffMinutes = (a, b) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000);
export const diffSeconds = (a, b) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000);

export const isPast = (date) => new Date(date).getTime() < Date.now();

/** Start of the ISO week (Monday 00:00) in the location timezone, returned as UTC Date. */
export function startOfWeek(date = new Date(), tz = TIMEZONE) {
  const zoned = toZonedParts(date, tz);
  const dow = zoned.weekday; // 0=Sun..6=Sat
  const daysSinceMonday = (dow + 6) % 7;
  const monday = new Date(Date.UTC(zoned.year, zoned.month - 1, zoned.day - daysSinceMonday, 0, 0, 0));
  return monday;
}

/** Parse the local wall-clock parts of a UTC date in a given timezone. */
export function toZonedParts(date, tz = TIMEZONE) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === '24' ? '0' : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: weekdayMap[parts.weekday],
  };
}

/** Local hour (0-23) in the location timezone. */
export const localHour = (date = new Date(), tz = TIMEZONE) => toZonedParts(date, tz).hour;
export const localWeekday = (date = new Date(), tz = TIMEZONE) => toZonedParts(date, tz).weekday;

/** ISO string for the same wall-clock day at a given HH:MM local time, as a UTC Date. */
export function atLocalTime(baseDate, hhmm, tz = TIMEZONE) {
  const [h, m] = hhmm.split(':').map(Number);
  const p = toZonedParts(baseDate, tz);
  // Build a Date in local tz by iterating offset — approximate but robust for scheduling.
  const guess = new Date(Date.UTC(p.year, p.month - 1, p.day, h, m, 0));
  const guessParts = toZonedParts(guess, tz);
  const driftMinutes = (guessParts.hour - h) * 60 + (guessParts.minute - m);
  return new Date(guess.getTime() - driftMinutes * 60_000);
}

export const formatTime = (date, tz = TIMEZONE) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(date));
