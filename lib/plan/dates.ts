/**
 * Calendar dates as `YYYY-MM-DD` strings with day arithmetic in UTC.
 *
 * An event date is a calendar day, not an instant, so it never carries a time
 * zone. Working in whole UTC days keeps "30 days before" exact on every device.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** Days since 1970-01-01 for a valid ISO date, or null. */
export function toDayNumber(iso: string): number | null {
  const match = ISO_DATE.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const ms = Date.UTC(y, m - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) {
    return null;
  }
  return ms / DAY_MS;
}

/** Whether a string is a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(value: string): boolean {
  return toDayNumber(value) !== null;
}

/** The UTC calendar day of a moment, as YYYY-MM-DD. */
export function utcDay(at: Date | number): string {
  return new Date(at).toISOString().slice(0, 10);
}

/** The ISO date for a day number counted from 1970-01-01. */
export function fromDayNumber(day: number): string {
  return utcDay(day * DAY_MS);
}

function dayOf(iso: string): number {
  const day = toDayNumber(iso);
  if (day === null) throw new RangeError("Not an ISO date");
  return day;
}

/** A date some days later, or earlier for a negative count. */
export function addDays(iso: string, days: number): string {
  return fromDayNumber(dayOf(iso) + days);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return dayOf(to) - dayOf(from);
}

/** The Saturday on or before a date. */
export function saturdayOnOrBefore(iso: string): string {
  const weekday = new Date(dayOf(iso) * DAY_MS).getUTCDay();
  return addDays(iso, -((weekday + 1) % 7));
}

/** Whole weeks from `from` to `to`, never below zero. */
export function wholeWeeks(from: string, to: string): number {
  return Math.max(0, Math.floor(daysBetween(from, to) / 7));
}

/** Today's calendar date where the user is, from a clock reading. */
export function localToday(now: Date = new Date()): string {
  const y = String(now.getFullYear()).padStart(4, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** `YYYYMMDD`, the compact form iCalendar and Google Calendar use. */
export function compactDate(iso: string): string {
  return fromDayNumber(dayOf(iso)).replaceAll("-", "");
}
