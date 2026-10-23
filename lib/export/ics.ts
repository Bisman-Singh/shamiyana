import { addDays, compactDate, daysBetween } from "@/lib/plan/dates";

/**
 * An RFC 5545 iCalendar file of the plan: one all-day entry per open task
 * plus the event itself, importable into any calendar app. Late tasks land
 * on today so they show up where the user looks.
 */

interface CalendarTask {
  id: string;
  title: string;
  due: string;
}

export interface CalendarInput {
  planId: string;
  eventTitle: string;
  eventDate: string;
  city: string;
  tasks: readonly CalendarTask[];
  today: string;
  /** Current instant, for DTSTAMP. */
  now: Date;
}

/** Escapes TEXT values: backslash, semicolon, comma and line breaks. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

const encoder = new TextEncoder();

/**
 * Folds a content line at 75 octets, as the RFC requires, without cutting a
 * multi-byte UTF-8 character: Hindi task titles stay readable after import.
 */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
      limit = 74;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function stamp(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function event(
  uid: string,
  date: string,
  summary: string,
  dtstamp: string,
  location: string,
): string[] {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}@shamiyana`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${compactDate(date)}`,
    `DTEND;VALUE=DATE:${compactDate(addDays(date, 1))}`,
    `SUMMARY:${escapeText(summary)}`,
    `LOCATION:${escapeText(location)}`,
    "TRANSP:TRANSPARENT",
    "END:VEVENT",
  ];
}

/** An iCalendar file with one all-day event per task given, overdue ones moved to today, plus the event day. */
export function buildIcs(input: CalendarInput): string {
  const dtstamp = stamp(input.now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Shamiyana//Event planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(input.eventTitle)}`,
    ...input.tasks.flatMap((task) => {
      const date = daysBetween(input.today, task.due) < 0 ? input.today : task.due;
      return event(`${input.planId}-${task.id}`, date, task.title, dtstamp, input.city);
    }),
    ...event(`${input.planId}-event`, input.eventDate, input.eventTitle, dtstamp, input.city),
    "END:VCALENDAR",
  ];
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
