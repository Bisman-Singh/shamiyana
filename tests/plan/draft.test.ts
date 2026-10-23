import { draftFromBrief, emptyDraft, parseDraft } from "@/lib/plan/draft";
import { sampleDraft } from "@/lib/plan/samples";
import { TODAY, communityBrief } from "@/tests/helpers/fixtures";

const example = { title: "Example", city: "Jaipur", notes: "" };

describe("draft", () => {
  it.each([
    ["", "dateInvalid"],
    ["2026-10-20", "datePast"],
    ["2030-01-01", "dateFar"],
  ])("explains a %j date as %s", (date, code) => {
    const result = parseDraft({ ...sampleDraft("birthday", TODAY, example), date }, TODAY);
    expect(result).toEqual({ ok: false, errors: { date: code } });
  });

  it("maps schema problems to the field that has them", () => {
    const result = parseDraft({ ...emptyDraft("wedding"), functions: [] }, TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort((a, b) => a.localeCompare(b))).toEqual([
        "budget",
        "city",
        "date",
        "functions",
        "guests",
        "title",
      ]);
    }
  });
});

describe("draftFromBrief", () => {
  it("keeps a community event's kind when editing", () => {
    expect(draftFromBrief(communityBrief).kind).toBe("festival");
  });
});
