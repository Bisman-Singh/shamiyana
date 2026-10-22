import { csvCell, toCsv } from "@/lib/export/csv";
import { buildIcs, escapeText, foldLine } from "@/lib/export/ics";
import { fileName, googleCalendarUrl, mapsSearchUrl } from "@/lib/export/links";
import {
  MAX_ENCODED,
  decodeShare,
  encodeShare,
  readShareHash,
  recordFromShare,
  shareUrl,
} from "@/lib/export/share";
import { planRecordSchema } from "@/lib/plan/schema";
import { NOW, TODAY, recordFor, sampleEnrichment, weddingBrief } from "../fixtures";

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

describe("CSV", () => {
  it.each([
    ['=HYPERLINK("x")', '"\'=HYPERLINK(""x"")"'],
    ["+91 98", "'+91 98"],
    ["-5", "'-5"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\tcmd", "'\tcmd"],
    ["plain", "plain"],
    ["a,b", '"a,b"'],
    ["line\nbreak", '"line\nbreak"'],
    ["मेहंदी", "मेहंदी"],
  ])("makes %j safe as %s", (input, output) => {
    expect(csvCell(input)).toBe(output);
  });

  it("writes numbers plainly and blanks non-finite ones", () => {
    expect(csvCell(-1500)).toBe("-1500");
    expect(csvCell(Number.NaN)).toBe("");
  });

  it("starts with a BOM and uses CRLF rows", () => {
    expect(
      toCsv([
        ["Category", "Amount"],
        ["Venue", 3_60_000],
      ]),
    ).toBe("﻿Category,Amount\r\nVenue,360000\r\n");
  });
});

describe("links", () => {
  it("builds a Google Calendar template for an all-day task", () => {
    const url = new URL(
      googleCalendarUrl("Book the venue & caterer", "2026-12-31", "From Shamiyana"),
    );
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Book the venue & caterer");
    expect(url.searchParams.get("dates")).toBe("20261231/20270101");
  });

  it("builds a Maps search with the city", () => {
    const url = new URL(mapsSearchUrl("wedding caterers", "Jaipur"));
    expect(url.hostname).toBe("www.google.com");
    expect(url.searchParams.get("query")).toBe("wedding caterers in Jaipur");
    expect(url.searchParams.get("api")).toBe("1");
  });

  it("makes safe file names in any script", () => {
    expect(fileName("Winter wedding in Jaipur!", "ics")).toBe("winter-wedding-in-jaipur.ics");
    expect(fileName("../../etc/passwd", "csv")).toBe("etc-passwd.csv");
    expect(fileName("दादी का जन्मदिन", "csv")).toBe("दादी-का-जन्मदिन.csv");
    expect(fileName("!!!", "json")).toBe("plan.json");
    expect(fileName(`${"a".repeat(47)} b`, "ics")).toBe(`${"a".repeat(47)}.ics`);
  });
});

describe("share links", () => {
  const record = recordFor(weddingBrief, {
    enrichment: sampleEnrichment,
    vendors: {
      venue: {
        status: "booked",
        quote: 3_00_000,
        paid: 50_000,
        note: "Manager's mobile 98765 43210",
      },
    },
    guests: [{ id: "g1", name: "Nani", group: "family", party: 1, rsvp: "yes", diet: "veg" }],
    done: ["w_book_venue"],
  });

  it("round-trips a plan without guests or vendor notes", async () => {
    const encoded = await encodeShare(record);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const shared = await decodeShare(encoded);
    expect(shared?.brief).toEqual(weddingBrief);
    expect(shared?.vendors.venue).toEqual({
      status: "booked",
      quote: 3_00_000,
      paid: 50_000,
      note: "",
    });
    expect(JSON.stringify(shared)).not.toContain("Nani");
    const imported = recordFromShare(shared ?? record, "plan-2", NOW);
    expect(imported).toMatchObject({ id: "plan-2", guests: [], done: ["w_book_venue"] });
    expect(planRecordSchema.safeParse(imported).success).toBe(true);
  });

  it("strips hidden control and direction characters from AI text in a shared plan", async () => {
    const tricky = {
      ...sampleEnrichment,
      theme: { name: "Pay\u202Eto UPI", summary: "Line\u0000one" },
    };
    const encoded = await encodeShare(recordFor(weddingBrief, { enrichment: tricky }));
    const shared = await decodeShare(encoded);
    const imported = recordFromShare(shared ?? record, "plan-3", NOW);
    expect(imported.enrichment?.theme).toEqual({ name: "Pay to UPI", summary: "Line one" });
  });

  it("rejects anything malformed, oversized or invalid", async () => {
    expect(await decodeShare("")).toBeNull();
    expect(await decodeShare("a".repeat(40_000))).toBeNull();
    expect(await decodeShare("a".repeat(MAX_ENCODED + 1))).toBeNull();
    expect(await decodeShare("not+base64/")).toBeNull();
    expect(await decodeShare("AAAA")).toBeNull();
    const packed = async (text: string) => {
      const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
      const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
    };
    expect(await decodeShare(await packed('{"v":1,"plan":{"brief":{}}}'))).toBeNull();
    expect(await decodeShare(await packed(" ".repeat(200_000)))).toBeNull();
  });

  it("reads and writes the fragment", () => {
    expect(shareUrl("https://plan.test", "abc")).toBe("https://plan.test/#plan=abc");
    expect(readShareHash("#plan=abc")).toBe("abc");
    expect(readShareHash("plan=xyz")).toBe("xyz");
    expect(readShareHash("#other=1")).toBeNull();
  });
});
