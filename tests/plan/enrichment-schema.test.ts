import type { CategoryId } from "@/lib/plan/constants";
import { enrichmentSchema, isEmptyEnrichment, sanitizeEnrichment } from "@/lib/plan/enrichment";
import { briefSchema, guestSchema, storeSchema } from "@/lib/plan/schema";
import { birthdayBrief, recordFor, sampleEnrichment, weddingBrief } from "../fixtures";

const CATS: CategoryId[] = ["venue", "catering", "decor", "contingency"];

describe("sanitizeEnrichment", () => {
  it("drops repeated lines, ignoring case, so every rendered list has unique keys", () => {
    const idea = { area: "decor", title: "Marigold canopy", detail: "", cost: "low" };
    const clean = sanitizeEnrichment(
      {
        ideas: [idea, { ...idea, title: "marigold CANOPY", detail: "again" }],
        menu: [
          { course: "Mains", dishes: ["Dal baati", "dal baati", "Gatte"] },
          { course: "mains", dishes: ["Kadhi"] },
        ],
        tasks: [
          { title: "Book a dhol", area: "entertainment", weeksBefore: 3 },
          { title: "Book a dhol", area: "entertainment", weeksBefore: 2 },
        ],
        questions: [
          { category: "venue", items: ["Parking?", "parking?"] },
          { category: "venue", items: ["Lifts?"] },
        ],
        risks: [
          { risk: "Rain", mitigation: "Tent" },
          { risk: "rain", mitigation: "Umbrellas" },
        ],
      },
      CATS,
    );
    expect(clean.ideas.map((i) => i.detail)).toEqual([""]);
    expect(clean.menu).toEqual([{ course: "Mains", dishes: ["Dal baati", "Gatte"] }]);
    expect(clean.tasks).toEqual([{ title: "Book a dhol", area: "entertainment", weeksBefore: 3 }]);
    expect(clean.questions).toEqual([{ category: "venue", items: ["Parking?"] }]);
    expect(clean.risks).toEqual([{ risk: "Rain", mitigation: "Tent" }]);
  });

  it("keeps a valid enrichment as it is", () => {
    const clean = sanitizeEnrichment(sampleEnrichment, CATS);
    expect(clean).toEqual(sampleEnrichment);
    expect(enrichmentSchema.parse(clean)).toEqual(clean);
  });

  it("turns garbage into an empty, valid enrichment", () => {
    for (const raw of [null, 42, "text", [], { theme: "x", ideas: "y", menu: [1, null] }]) {
      const clean = sanitizeEnrichment(raw, CATS);
      expect(isEmptyEnrichment(clean)).toBe(true);
      expect(enrichmentSchema.safeParse(clean).success).toBe(true);
    }
  });

  it("handles a half-streamed object", () => {
    const clean = sanitizeEnrichment(
      { theme: { name: "Mehfil" }, ideas: [{ title: "Qawwali" }, {}] },
      CATS,
    );
    expect(clean.theme).toEqual({ name: "Mehfil", summary: "" });
    expect(clean.ideas).toEqual([{ area: "theme", title: "Qawwali", detail: "", cost: "medium" }]);
    expect(isEmptyEnrichment(clean)).toBe(false);
  });

  it("cuts long text and long lists to their limits", () => {
    const long = "क".repeat(1000);
    const clean = sanitizeEnrichment(
      {
        theme: { name: long, summary: long },
        ideas: Array.from({ length: 20 }, (_, n) => ({
          area: "food",
          title: `${String(n)}${long}`,
          detail: long,
          cost: "low",
        })),
        menu: [
          { course: "Mains", dishes: Array.from({ length: 20 }, (_, n) => `Dal ${String(n)}`) },
          { course: "", dishes: ["x"] },
        ],
        risks: [
          { risk: "Rain", mitigation: "" },
          { risk: "Heat", mitigation: "Shade" },
        ],
      },
      CATS,
    );
    expect(clean.theme.name).toHaveLength(60);
    expect(clean.ideas).toHaveLength(8);
    expect(clean.menu).toEqual([
      { course: "Mains", dishes: Array.from({ length: 8 }, (_, n) => `Dal ${String(n)}`) },
    ]);
    expect(clean.risks).toEqual([{ risk: "Heat", mitigation: "Shade" }]);
    expect(enrichmentSchema.safeParse(clean).success).toBe(true);
  });

  it("keeps budget shifts only for this plan's categories, clamped and once each", () => {
    const clean = sanitizeEnrichment(
      {
        shifts: [
          { category: "decor", factor: 3, reason: "More flowers" },
          { category: "decor", factor: 0.7, reason: "Duplicate" },
          { category: "stay", factor: 1.2, reason: "Not in this plan" },
          { category: "contingency", factor: 1.2, reason: "Never shifted" },
          { category: "venue", factor: 1, reason: "No change" },
          { category: "catering", factor: "high", reason: "Not a number" },
          { category: "catering", factor: 0.777, reason: "Smaller menu" },
        ],
      },
      CATS,
    );
    expect(clean.shifts).toEqual([
      { category: "decor", factor: 1.5, reason: "More flowers" },
      { category: "catering", factor: 0.78, reason: "Smaller menu" },
    ]);
  });

  it("rounds and clamps task weeks, defaults areas and drops empty question groups", () => {
    const clean = sanitizeEnrichment(
      {
        tasks: [
          { title: "Book dhol", area: "entertainment", weeksBefore: 3.6 },
          { title: "Too far", area: "nowhere", weeksBefore: 400 },
          { title: "No weeks" },
          { title: "" },
        ],
        questions: [
          { category: "venue", items: ["Parking?", "", 5] },
          { category: "unknown", items: ["x"] },
          { category: "decor", items: [] },
          { category: "decor" },
        ],
      },
      CATS,
    );
    expect(clean.tasks).toEqual([
      { title: "Book dhol", area: "entertainment", weeksBefore: 4 },
      { title: "Too far", area: "planning", weeksBefore: 52 },
      { title: "No weeks", area: "planning", weeksBefore: 0 },
    ]);
    expect(clean.questions).toEqual([{ category: "venue", items: ["Parking?"] }]);
  });

  it("defaults an unknown idea area and cost", () => {
    const [idea] = sanitizeEnrichment(
      { ideas: [{ area: "rockets", title: "Lanterns", cost: "free" }] },
      CATS,
    ).ideas;
    expect(idea).toEqual({ area: "theme", title: "Lanterns", detail: "", cost: "medium" });
  });

  it("tolerates a menu course without a dish list", () => {
    expect(sanitizeEnrichment({ menu: [{ course: "Sweets" }] }, CATS).menu).toEqual([]);
  });
});

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
