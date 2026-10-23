import type { CategoryId, EventType } from "./constants";

/**
 * Google Maps search phrases for finding vendors near the event city. They
 * stay in English on both language pages, since that is what finds the most
 * listings; the page marks them with their own language.
 */

/** The phrase per event type and kind of vendor. */
export const VENDOR_SEARCH: Record<EventType, Partial<Record<CategoryId, string>>> = {
  wedding: {
    venue: "wedding venues",
    catering: "wedding caterers",
    decor: "wedding decorators",
    photo: "wedding photographers",
    attire: "bridal wear",
    beauty: "bridal makeup artists",
    entertainment: "wedding DJ",
    invitations: "wedding card printers",
    rituals: "pandit or priest for wedding",
    transport: "wedding car rental",
    stay: "hotels",
    gifts: "return gifts shop",
  },
  birthday: {
    venue: "party halls",
    catering: "party caterers",
    cake: "cake shops",
    decor: "birthday decorators",
    entertainment: "birthday party entertainers",
    gifts: "return gifts shop",
    photo: "event photographers",
    invitations: "printing shops",
  },
  community: {
    rituals: "pandit or priest for puja",
    venue: "community halls",
    catering: "caterers",
    entertainment: "sound and stage rental",
    decor: "tent house",
    permits: "police station",
    publicity: "flex printing",
    sanitation: "waste management services",
    transport: "tempo rental",
    gifts: "trophy shop",
  },
};

/** Plain phrases for a category an event type doesn't usually hire for. */
const FALLBACK_SEARCH: Record<CategoryId, string> = {
  venue: "event venues",
  catering: "caterers",
  cake: "cake shops",
  decor: "event decorators",
  photo: "event photographers",
  attire: "ethnic wear",
  beauty: "makeup artists",
  entertainment: "event entertainers",
  invitations: "printing shops",
  rituals: "pandit services",
  transport: "car rental",
  stay: "hotels",
  gifts: "gift shops",
  permits: "police station",
  publicity: "flex printing",
  sanitation: "waste management services",
  contingency: "event planners",
};

/** The search phrase for this kind of vendor at this kind of event. */
export function vendorSearch(type: EventType, category: CategoryId): string {
  return VENDOR_SEARCH[type][category] ?? FALLBACK_SEARCH[category];
}
