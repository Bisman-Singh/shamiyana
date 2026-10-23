import { addDays, compactDate } from "@/lib/plan/dates";

/**
 * Outbound links built from fixed bases with every value URL-encoded. The
 * model never supplies a URL: vendor discovery is a Maps search the user runs.
 */

/** A Google Calendar link that adds the task as an all-day event on its date. */
export function googleCalendarUrl(title: string, date: string, details: string): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${compactDate(date)}/${compactDate(addDays(date, 1))}`,
    details,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** A Google Maps search for a kind of vendor in the event's city. */
export function mapsSearchUrl(phrase: string, city: string): string {
  const params = new URLSearchParams({ api: "1", query: `${phrase} in ${city}` });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}
