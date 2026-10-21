import { BASE_SHARES, TASKS, TASK_IDS, VENDOR_SEARCH, variantFactors } from "@/lib/plan/catalog";
import { COMMUNITY_KINDS, EVENT_TYPES, HONOREES } from "@/lib/plan/constants";
import { birthdayBrief, communityBrief, weddingBrief } from "../fixtures";

describe("catalog", () => {
  it.each(EVENT_TYPES)("splits a %s budget into shares that sum to 1", (type) => {
    const total = Object.values(BASE_SHARES[type]).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(BASE_SHARES[type].contingency).toBeGreaterThan(0);
  });

  it("keeps task ids unique across every event type", () => {
    expect(new Set(TASK_IDS).size).toBe(TASK_IDS.length);
  });

  it.each(EVENT_TYPES)("only searches for vendors the %s budget has", (type) => {
    for (const category of Object.keys(VENDOR_SEARCH[type])) {
      expect(BASE_SHARES[type]).toHaveProperty(category);
    }
  });

  it("lists tasks from the furthest ahead down to the last day", () => {
    for (const type of EVENT_TYPES) {
      const leads = TASKS[type].map((t) => t.leadDays);
      expect(leads).toEqual([...leads].sort((a, b) => b - a));
    }
  });
});

describe("variantFactors", () => {
  it("weights a wedding by its functions and size", () => {
    expect(variantFactors(weddingBrief)).toEqual({
      catering: 1.18,
      decor: 1.15,
      beauty: 1.5,
      entertainment: 1.6,
      rituals: 1.25,
      stay: 1.4,
    });
    const small = variantFactors({ ...weddingBrief, functions: ["wedding"], guests: 80 });
    expect(small).toEqual({
      catering: 1,
      decor: 1,
      beauty: 1,
      entertainment: 1,
      rituals: 1,
      stay: 1,
    });
    expect(variantFactors({ ...weddingBrief, functions: ["roka", "wedding"] }).rituals).toBe(1.25);
  });

  it.each(HONOREES)("has a tilt for a %s birthday", (honoree) => {
    expect(Object.keys(variantFactors({ ...birthdayBrief, honoree })).length).toBeGreaterThan(0);
  });

  it.each(COMMUNITY_KINDS)("has a tilt for a %s community event", (kind) => {
    expect(Object.keys(variantFactors({ ...communityBrief, kind })).length).toBeGreaterThan(0);
  });
});
