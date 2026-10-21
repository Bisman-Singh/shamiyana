import { emptyDraft, parseDraft, readAmount, sampleDraft } from "@/lib/plan/draft";
import { TODAY } from "../fixtures";

describe("draft", () => {
  it("reads amounts typed the Indian way", () => {
    expect(readAmount("₹18,00,000")).toBe(1_800_000);
    expect(readAmount("18 00 000")).toBe(1_800_000);
    expect(readAmount("")).toBeNull();
    expect(readAmount("abc")).toBeNull();
    expect(readAmount("1234567890123")).toBeNull();
  });

  it("dates every example in the future", () => {
    for (const type of ["wedding", "birthday", "community"] as const) {
      const result = parseDraft(sampleDraft(type, TODAY, "Example"), TODAY);
      expect(result.ok).toBe(true);
    }
  });

  it.each([
    ["", "dateInvalid"],
    ["2026-10-20", "datePast"],
    ["2030-01-01", "dateFar"],
  ])("explains a %j date as %s", (date, code) => {
    const result = parseDraft({ ...sampleDraft("birthday", TODAY, "x"), date }, TODAY);
    expect(result).toEqual({ ok: false, errors: { date: code } });
  });

  it("maps schema problems to the field that has them", () => {
    const result = parseDraft({ ...emptyDraft("wedding"), functions: [] }, TODAY);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual([
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
