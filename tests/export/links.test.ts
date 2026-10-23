import { fileName, googleCalendarUrl, mapsSearchUrl } from "@/lib/export/links";

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
