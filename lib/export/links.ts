import { addDays, compactDate } from "@/lib/plan/dates";

/**
 * Outbound links built from fixed bases with every value URL-encoded. The
 * model never supplies a URL: vendor discovery is a Maps search the user runs.
 */

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

/** A file name from a plan title: letters and digits in any script, nothing that changes directory. */
export function fileName(title: string, extension: string): string {
  const slug = title
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
    .replace(/-$/, "");
  return `${slug === "" ? "plan" : slug}.${extension}`;
}
