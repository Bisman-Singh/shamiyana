import { planBudget } from "@/lib/plan/budget";
import { isSecured } from "@/lib/plan/vendor-status";
import { EMPTY_PROGRESS, buildVendors, securedCount, vendorTally } from "@/lib/plan/vendors";
import { birthdayBrief, recordFor, sampleEnrichment, weddingBrief } from "@/tests/helpers/fixtures";

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
    const cards = buildVendors(record, planBudget(birthdayBrief, {}));
    expect(vendorTally(cards)).toEqual({ todo: 5, shortlisted: 1, booked: 1, paid: 1 });
    expect(securedCount(cards)).toBe(2);
    expect([
      isSecured("todo"),
      isSecured("shortlisted"),
      isSecured("booked"),
      isSecured("paid"),
    ]).toEqual([false, false, true, true]);
  });
});
