import { planBudget } from "@/lib/plan/budget";
import { tallyGuests } from "@/lib/plan/guests";
import type { Guest } from "@/lib/plan/schema";
import { EMPTY_PROGRESS, buildVendors, isSecured, vendorTally } from "@/lib/plan/vendors";
import { birthdayBrief, recordFor, sampleEnrichment, weddingBrief } from "../fixtures";

describe("buildVendors", () => {
  it("makes a card for every paid category, never for contingency", () => {
    const record = recordFor(weddingBrief);
    const cards = buildVendors(record, planBudget(weddingBrief, {}));
    expect(cards.map((c) => c.category)).not.toContain("contingency");
    expect(cards).toHaveLength(12);
    expect(cards[0]).toMatchObject({
      category: "venue",
      progress: EMPTY_PROGRESS,
      search: "wedding venues",
    });
  });

  it("merges AI questions per category and keeps saved progress", () => {
    const record = recordFor(weddingBrief, {
      enrichment: {
        ...sampleEnrichment,
        questions: [
          { category: "catering", items: ["Live counters?"] },
          { category: "catering", items: ["Tasting fee?"] },
        ],
      },
      vendors: { catering: { status: "booked", quote: 5_00_000, paid: 0, note: "" } },
    });
    const catering = buildVendors(record, planBudget(weddingBrief, {})).find(
      (c) => c.category === "catering",
    );
    expect(catering?.aiQuestions).toEqual(["Live counters?", "Tasting fee?"]);
    expect(catering?.progress.status).toBe("booked");
  });

  it("falls back to a plain search phrase for a category the event type rarely hires for", () => {
    const record = recordFor(birthdayBrief);
    const [card] = buildVendors(record, [{ category: "stay", share: 1, amount: 100 }]);
    expect(card?.search).toBe("hotels");
  });

  it("tallies statuses and knows what is secured", () => {
    const record = recordFor(birthdayBrief, {
      vendors: {
        venue: { status: "paid", quote: 1, paid: 1, note: "" },
        cake: { status: "booked", quote: 1, paid: 0, note: "" },
        decor: { status: "shortlisted", quote: 0, paid: 0, note: "" },
      },
    });
    const tally = vendorTally(buildVendors(record, planBudget(birthdayBrief, {})));
    expect(tally).toEqual({ todo: 5, shortlisted: 1, booked: 1, paid: 1 });
    expect([
      isSecured("todo"),
      isSecured("shortlisted"),
      isSecured("booked"),
      isSecured("paid"),
    ]).toEqual([false, false, true, true]);
  });
});

describe("tallyGuests", () => {
  const guest = (patch: Partial<Guest>): Guest => ({
    id: "g",
    name: "Nani",
    group: "family",
    party: 1,
    rsvp: "pending",
    diet: "veg",
    ...patch,
  });

  it("counts people, not invitations", () => {
    const tally = tallyGuests([
      guest({ party: 4, rsvp: "yes" }),
      guest({ party: 2, rsvp: "maybe", diet: "jain", group: "neighbours" }),
      guest({ party: 3, rsvp: "no", diet: "nonveg", group: "work" }),
      guest({ party: 1, group: "friends" }),
    ]);
    expect(tally).toEqual({
      parties: 4,
      invited: 10,
      byRsvp: { pending: 1, yes: 4, maybe: 2, no: 3 },
      expected: 6,
      diets: { veg: 4, nonveg: 0, jain: 2, vegan: 0 },
      byGroup: { family: 4, friends: 1, work: 3, neighbours: 2, other: 0 },
    });
  });

  it("is all zeros for an empty list", () => {
    expect(tallyGuests([])).toMatchObject({ parties: 0, invited: 0, expected: 0 });
  });
});
