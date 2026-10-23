import { briefSchema, guestSchema, storeSchema } from "@/lib/plan/schema";
import { birthdayBrief, recordFor, sampleEnrichment, weddingBrief } from "../helpers/fixtures";

describe("briefSchema", () => {
  it.each([weddingBrief, birthdayBrief])("accepts a valid $type brief", (brief) => {
    expect(briefSchema.parse(brief)).toEqual(brief);
  });

  it("cleans text fields and keeps newlines only in notes", () => {
    const parsed = briefSchema.parse({
      ...birthdayBrief,
      title: " Dadi\nturns 80\u202E ",
      notes: "Line one\nLine two\u0000",
    });
    expect(parsed.title).toBe("Dadi turns 80");
    expect(parsed.notes).toBe("Line one\nLine two");
  });

  it.each([
    ["an unknown key", { ...weddingBrief, admin: true }],
    ["a duplicate function", { ...weddingBrief, functions: ["wedding", "wedding"] }],
    ["no functions", { ...weddingBrief, functions: [] }],
    ["an impossible date", { ...weddingBrief, date: "2027-02-30" }],
    ["a fractional guest count", { ...weddingBrief, guests: 10.5 }],
    ["a budget below the floor", { ...weddingBrief, budget: 100 }],
    ["a title that is only spaces", { ...weddingBrief, title: "   " }],
    ["notes that are too long", { ...weddingBrief, notes: "x".repeat(501) }],
    ["a wedding field on a birthday", { ...birthdayBrief, functions: ["wedding"] }],
    ["an unknown type", { ...birthdayBrief, type: "funeral" }],
  ])("rejects %s", (_label, value) => {
    expect(briefSchema.safeParse(value).success).toBe(false);
  });
});

describe("storage schemas", () => {
  it("round-trips a store with a full record", () => {
    const store = {
      version: 1,
      activeId: "plan-1",
      plans: [
        recordFor(weddingBrief, {
          enrichment: sampleEnrichment,
          guests: [
            { id: "g1", name: "Mausi", group: "family", party: 2, rsvp: "yes", diet: "jain" },
          ],
        }),
      ],
    };
    expect(storeSchema.parse(store)).toEqual(store);
  });

  it("rejects ids that could break out of an attribute or a file name", () => {
    const base = { name: "Mama", group: "family", party: 1, rsvp: "yes", diet: "veg" };
    expect(guestSchema.safeParse({ ...base, id: '"><img>' }).success).toBe(false);
    expect(guestSchema.safeParse({ ...base, id: "../x" }).success).toBe(false);
  });
});
