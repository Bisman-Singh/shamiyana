import type { CategoryId, CommunityKind, EventType, Honoree, WeddingFunction } from "./constants";
import type { EventFacts } from "./schema";

/**
 * How each kind of event usually splits its budget, as data. Code turns this
 * into the plan's budget; the model may only nudge a line within its bounds.
 */

/** A weight or share per budget line; a missing line is 1 for weights and absent for shares. */
export type Shares = Partial<Record<CategoryId, number>>;

/** Starting budget split per event type. Each row sums to 1 and keeps a contingency. */
export const BASE_SHARES: Record<EventType, Shares & { contingency: number }> = {
  wedding: {
    venue: 0.18,
    catering: 0.27,
    decor: 0.12,
    photo: 0.07,
    attire: 0.1,
    beauty: 0.03,
    entertainment: 0.04,
    invitations: 0.02,
    rituals: 0.02,
    transport: 0.03,
    stay: 0.02,
    gifts: 0.02,
    contingency: 0.08,
  },
  birthday: {
    venue: 0.18,
    catering: 0.34,
    cake: 0.08,
    decor: 0.12,
    entertainment: 0.1,
    gifts: 0.06,
    photo: 0.05,
    invitations: 0.02,
    contingency: 0.05,
  },
  community: {
    venue: 0.22,
    catering: 0.25,
    entertainment: 0.15,
    decor: 0.07,
    permits: 0.06,
    publicity: 0.05,
    sanitation: 0.05,
    transport: 0.04,
    gifts: 0.03,
    rituals: 0.03,
    contingency: 0.05,
  },
};

/** What each wedding function adds to a category's weight, on top of 1. */
const FUNCTION_TILTS: Record<WeddingFunction, Shares> = {
  roka: { rituals: 0.1, gifts: 0.2, catering: 0.08 },
  haldi: { rituals: 0.15, decor: 0.03, catering: 0.06, photo: 0.05 },
  mehndi: { beauty: 0.5, decor: 0.04, catering: 0.1, entertainment: 0.1, photo: 0.08 },
  sangeet: { entertainment: 0.6, decor: 0.05, catering: 0.18, photo: 0.12 },
  wedding: {},
  reception: { venue: 0.35, catering: 0.4, decor: 0.06, photo: 0.1 },
};

/** Share of the guest list a function usually feeds: haldi and mehndi are mostly close family. */
export const FUNCTION_HEADCOUNT: Record<WeddingFunction, number> = {
  roka: 0.3,
  haldi: 0.3,
  mehndi: 0.5,
  sangeet: 0.8,
  wedding: 1,
  reception: 1,
};

/** Wedding tilts are increments on 1 that add up across the functions chosen, plus rooms for a big list. */
function weddingTilts(functions: readonly WeddingFunction[], guests: number): Shares {
  const tilts: Shares = {};
  const add = (category: CategoryId, amount: number) => {
    tilts[category] = Math.round(((tilts[category] ?? 1) + amount) * 100) / 100;
  };
  for (const fn of functions) {
    for (const [category, amount] of Object.entries(FUNCTION_TILTS[fn])) {
      add(category as CategoryId, amount);
    }
  }
  if (guests >= 150) add("stay", 0.4);
  return tilts;
}

/** How each kind of birthday tilts the base split, as multipliers on its share. */
const HONOREE_TILTS: Record<Honoree, Shares> = {
  child: { entertainment: 1.3, gifts: 1.3 },
  teen: { entertainment: 1.2 },
  adult: { catering: 1.1 },
  milestone: { photo: 1.3, decor: 1.2 },
};

/** How each kind of community event tilts the base split; 0 means the event has no such line. */
const KIND_TILTS: Record<CommunityKind, Shares> = {
  festival: { decor: 1.3, permits: 1.2 },
  cultural: { entertainment: 1.4, rituals: 0 },
  fundraiser: { publicity: 1.6, catering: 0.8, rituals: 0 },
  sports: { gifts: 1.8, permits: 1.3, rituals: 0 },
  cleanup: {
    sanitation: 2.5,
    catering: 0.6,
    entertainment: 0.4,
    decor: 0.4,
    venue: 0.2,
    rituals: 0,
  },
};

/** How the event's details tilt the base split before it is renormalised. */
export function variantFactors(facts: EventFacts): Shares {
  switch (facts.type) {
    case "wedding":
      return weddingTilts(facts.functions, facts.guests);
    case "birthday":
      return HONOREE_TILTS[facts.honoree];
    case "community":
      return KIND_TILTS[facts.kind];
  }
}

/** The budget lines this event actually has and may move money between: all but contingency. */
export function shiftableCategories(facts: EventFacts): CategoryId[] {
  const tilts = variantFactors(facts);
  return (Object.keys(BASE_SHARES[facts.type]) as CategoryId[]).filter(
    (category) => category !== "contingency" && tilts[category] !== 0,
  );
}
