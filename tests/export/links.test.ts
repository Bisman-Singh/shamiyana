import { googleCalendarUrl, mapsSearchUrl } from "@/lib/export/links";

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
});
