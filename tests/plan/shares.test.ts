import { COMMUNITY_KINDS, EVENT_TYPES, HONOREES } from "@/lib/plan/constants";
import { BASE_SHARES, shiftableCategories, variantFactors } from "@/lib/plan/shares";
import { birthdayBrief, communityBrief, weddingBrief } from "../helpers/fixtures";

describe("BASE_SHARES", () => {
  it.each(EVENT_TYPES)("splits a %s budget into shares that sum to 1", (type) => {
    const total = Object.values(BASE_SHARES[type]).reduce((sum, share) => sum + share, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(BASE_SHARES[type].contingency).toBeGreaterThan(0);
  });
});

describe("variantFactors", () => {
  it("weights a wedding by its functions and size", () => {
    expect(variantFactors(weddingBrief)).toEqual({
      rituals: 1.15,
      decor: 1.12,
      catering: 1.34,
      photo: 1.25,
      beauty: 1.5,
      entertainment: 1.7,
      stay: 1.4,
    });
    expect(variantFactors({ ...weddingBrief, functions: ["wedding"], guests: 80 })).toEqual({});
    expect(
      variantFactors({ ...weddingBrief, functions: ["reception", "wedding"], guests: 80 }),
    ).toEqual({
      venue: 1.35,
      catering: 1.4,
      decor: 1.06,
      photo: 1.1,
    });
    expect(variantFactors({ ...weddingBrief, functions: ["roka", "wedding"] }).gifts).toBeCloseTo(
      1.2,
      10,
    );
  });

  it.each(HONOREES)("has a tilt for a %s birthday", (honoree) => {
    expect(Object.keys(variantFactors({ ...birthdayBrief, honoree })).length).toBeGreaterThan(0);
  });

  it("gives only a festival a rituals line, and keeps contingency out of the shiftable lines", () => {
    expect(shiftableCategories(communityBrief)).toContain("rituals");
    for (const kind of ["cultural", "fundraiser", "sports", "cleanup"] as const) {
      expect(shiftableCategories({ ...communityBrief, kind })).not.toContain("rituals");
    }
    expect(shiftableCategories(weddingBrief)).not.toContain("contingency");
  });

  it.each(COMMUNITY_KINDS)("has a tilt for a %s community event", (kind) => {
    expect(Object.keys(variantFactors({ ...communityBrief, kind })).length).toBeGreaterThan(0);
  });
});
