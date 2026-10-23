import { getDictionary } from "@/lib/i18n";
import { EVENT_TYPES } from "@/lib/plan/constants";
import { parseDraft } from "@/lib/plan/draft";
import { createRecord } from "@/lib/plan/record";
import { diwaliMelaDate, sampleDraft, winterWeddingDate } from "@/lib/plan/samples";
import { buildTimeline } from "@/lib/plan/timeline";
import { TODAY } from "@/tests/helpers/fixtures";

const example = { title: "Example", city: "Jaipur", notes: "" };

describe("samples", () => {
  it("dates the sample wedding on the earliest season day that leaves time for every task", () => {
    expect(winterWeddingDate("2026-01-20")).toBe("2026-11-25");
    expect(winterWeddingDate("2026-02-01")).toBe("2026-12-05");
    expect(winterWeddingDate("2027-02-09")).toBe("2028-02-10");
    expect(winterWeddingDate("2026-05-01")).toBe("2027-11-25");
    expect(winterWeddingDate("2026-10-22")).toBe("2027-11-25");
  });
  it("dates the sample mela on the Saturday at least six days before Diwali", () => {
    expect(diwaliMelaDate("2026-08-01")).toBe("2026-10-31");
    expect(diwaliMelaDate("2026-10-22")).toBe("2027-10-23");
    expect(diwaliMelaDate("2028-01-01")).toBe("2028-10-07");
    expect(diwaliMelaDate("2029-01-01")).toBe("2029-10-27");
    expect(diwaliMelaDate("2030-01-01")).toBe("2030-03-02");
  });
  it("opens every sample with nothing overdue, whatever the day", () => {
    const f = getDictionary("en").form;
    for (const today of ["2026-01-01", "2026-06-15", "2026-10-22", "2027-11-30", "2029-12-31"]) {
      for (const type of EVENT_TYPES) {
        const text = {
          title: f.sampleTitles[type],
          city: f.sampleCities[type],
          notes: f.sampleNotes[type],
        };
        const parsed = parseDraft(sampleDraft(type, today, text), today);
        if (!parsed.ok) throw new Error(`${type} sample invalid on ${today}`);
        const record = createRecord(parsed.brief, "sample", `${today}T00:00:00.000Z`);
        expect({ today, type, late: buildTimeline(record, today).lateCount }).toEqual({
          today,
          type,
          late: 0,
        });
      }
    }
  });
  it("builds every example from the dictionary of either language", () => {
    for (const locale of ["en", "hi"] as const) {
      const f = getDictionary(locale).form;
      for (const type of EVENT_TYPES) {
        const text = {
          title: f.sampleTitles[type],
          city: f.sampleCities[type],
          notes: f.sampleNotes[type],
        };
        const result = parseDraft(sampleDraft(type, TODAY, text), TODAY);
        expect(result.ok && result.brief.city).toBe(f.sampleCities[type]);
      }
    }
    expect(getDictionary("hi").form.sampleCities.wedding).toBe("जयपुर");
  });
  it("dates every example in the future", () => {
    for (const type of ["wedding", "birthday", "community"] as const) {
      const result = parseDraft(sampleDraft(type, TODAY, example), TODAY);
      expect(result.ok).toBe(true);
    }
  });
});
