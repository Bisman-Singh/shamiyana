import { buildIcs, escapeText, foldLine } from "@/lib/export/ics";
import { NOW, TODAY } from "../helpers/fixtures";

const octets = (s: string) => new TextEncoder().encode(s).length;

describe("iCalendar", () => {
  it("escapes TEXT values", () => {
    expect(escapeText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });

  it("folds at 75 octets without splitting a Devanagari character", () => {
    const line = `SUMMARY:${"मेहंदी कलाकार बुक करें ".repeat(8)}`;
    const folded = foldLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    expect(octets(parts[0] ?? "")).toBeLessThanOrEqual(75);
    for (const part of parts.slice(1)) {
      expect(part.startsWith(" ")).toBe(true);
      expect(octets(part)).toBeLessThanOrEqual(75);
    }
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(line);
    expect(foldLine("SHORT:x")).toBe("SHORT:x");
  });

  it("writes one all-day entry per task plus the event, late tasks moved to today", () => {
    const ics = buildIcs({
      planId: "plan-1",
      eventTitle: "Winter wedding, Jaipur",
      eventDate: "2027-02-14",
      city: "Jaipur",
      tasks: [
        { id: "w_book_venue", title: "Book the venue", due: "2026-06-19" },
        { id: "w_send_invites", title: "Send invitations", due: "2026-12-31" },
      ],
      today: TODAY,
      now: new Date(NOW),
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain(
      "UID:plan-1-w_book_venue@shamiyana\r\nDTSTAMP:20261021T100000Z\r\nDTSTART;VALUE=DATE:20261021",
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101");
    expect(ics).toContain("SUMMARY:Winter wedding\\, Jaipur");
    expect(ics).not.toMatch(/[^\r]\n/);
  });
});
