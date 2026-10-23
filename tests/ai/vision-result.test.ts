import { REDACTED } from "@/lib/ai/redact";
import { sanitizeVision, visionResultSchema } from "@/lib/ai/vision-result";

describe("vision results", () => {
  it("keeps only real hex colours and bounded text", () => {
    const clean = sanitizeVision({
      kind: "alien",
      mood: "x".repeat(400),
      palette: [
        { name: "Saffron", hex: "f39b2d" },
        { name: "Bad", hex: "#zzzzzz" },
        { name: "Num", hex: 5 },
        "junk",
      ],
      ideas: [{ title: "Torans", detail: "Doors", area: "nowhere" }, { title: "" }],
      notes: ["Wide hall", "", 7],
    });
    expect(clean.kind).toBe("other");
    expect(clean.mood).toHaveLength(200);
    expect(clean.palette).toEqual([{ name: "Saffron", hex: "#f39b2d" }]);
    expect(clean.ideas).toEqual([{ area: "decor", title: "Torans", detail: "Doors" }]);
    expect(clean.notes).toEqual(["Wide hall"]);
    expect(visionResultSchema.safeParse(clean).success).toBe(true);
    const twice = sanitizeVision({
      palette: [
        { name: "Saffron", hex: "#F39B2D" },
        { name: "Marigold", hex: "f39b2d" },
      ],
      ideas: [
        { area: "decor", title: "Torans", detail: "" },
        { area: "decor", title: "torans", detail: "" },
      ],
      notes: ["Wide hall", "Wide hall"],
    });
    expect(twice.palette).toEqual([{ name: "Saffron", hex: "#f39b2d" }]);
    const card = sanitizeVision({
      mood: "Festive, RSVP on 98765 43210",
      ideas: [{ area: "decor", title: "Card colours", detail: "Mail rsvp@example.in for cards" }],
      notes: ["Printed number +91-9876543210"],
    });
    expect(JSON.stringify(card)).not.toMatch(/9876|rsvp@/);
    expect(card.mood).toBe(`Festive, RSVP on ${REDACTED}`);
    expect(twice.ideas).toHaveLength(1);
    expect(twice.notes).toEqual(["Wide hall"]);
    expect(sanitizeVision(null)).toEqual({
      kind: "other",
      mood: "",
      palette: [],
      ideas: [],
      notes: [],
    });
  });
});
