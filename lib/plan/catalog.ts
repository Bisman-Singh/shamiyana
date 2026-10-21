import type { CategoryId, EventType, TaskArea } from "./constants";
import type { Brief } from "./schema";

/**
 * Planning knowledge as data: how each kind of event usually splits its
 * budget, which jobs need doing and how far ahead. Code turns this into a
 * plan; the model only personalises it.
 */

type Shares = Partial<Record<CategoryId, number>>;

/** Starting budget split per event type. Each row sums to 1. */
export const BASE_SHARES: Record<EventType, Shares> = {
  wedding: {
    venue: 0.2,
    catering: 0.28,
    decor: 0.12,
    photo: 0.08,
    attire: 0.1,
    beauty: 0.03,
    entertainment: 0.04,
    invitations: 0.02,
    rituals: 0.02,
    transport: 0.02,
    stay: 0.02,
    gifts: 0.02,
    contingency: 0.05,
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
    decor: 0.08,
    permits: 0.06,
    publicity: 0.05,
    sanitation: 0.05,
    transport: 0.06,
    gifts: 0.03,
    contingency: 0.05,
  },
};

/** How the event's details tilt the base split before it is renormalised. */
export function variantFactors(brief: Brief): Shares {
  switch (brief.type) {
    case "wedding": {
      const has = (f: (typeof brief.functions)[number]) => brief.functions.includes(f);
      const extra = brief.functions.filter((f) => f !== "wedding").length;
      return {
        catering: 1 + 0.06 * extra,
        decor: 1 + 0.05 * extra,
        beauty: has("mehndi") ? 1.5 : 1,
        entertainment: has("sangeet") ? 1.6 : 1,
        rituals: has("haldi") || has("roka") ? 1.25 : 1,
        stay: brief.guests >= 150 ? 1.4 : 1,
      };
    }
    case "birthday":
      return {
        child: { entertainment: 1.3, gifts: 1.3 },
        teen: { entertainment: 1.2 },
        adult: { catering: 1.1 },
        milestone: { photo: 1.3, decor: 1.2 },
      }[brief.honoree];
    case "community":
      return {
        festival: { decor: 1.3, permits: 1.2 },
        cultural: { entertainment: 1.4 },
        fundraiser: { publicity: 1.6, catering: 0.8 },
        sports: { gifts: 1.8, permits: 1.3 },
        cleanup: { sanitation: 2.5, catering: 0.6, entertainment: 0.4, decor: 0.4 },
      }[brief.kind];
  }
}

export interface TaskTemplate {
  id: string;
  area: TaskArea;
  /** Days before the event this is ideally done by. */
  leadDays: number;
  when?: (brief: Brief) => boolean;
}

const wedding = (brief: Brief, fn: string) =>
  brief.type === "wedding" && brief.functions.some((f) => f === fn);

export const TASKS: Record<EventType, readonly TaskTemplate[]> = {
  wedding: [
    { id: "w_budget_guests", area: "planning", leadDays: 300 },
    { id: "w_book_venue", area: "venue", leadDays: 240 },
    { id: "w_roka", area: "rituals", leadDays: 200, when: (b) => wedding(b, "roka") },
    { id: "w_book_caterer", area: "catering", leadDays: 180 },
    { id: "w_book_photo", area: "photo", leadDays: 180 },
    { id: "w_book_reception", area: "venue", leadDays: 180, when: (b) => wedding(b, "reception") },
    { id: "w_book_decor", area: "decor", leadDays: 150 },
    { id: "w_book_priest", area: "rituals", leadDays: 150 },
    { id: "w_outfits", area: "attire", leadDays: 120 },
    { id: "w_book_makeup", area: "beauty", leadDays: 120 },
    { id: "w_book_mehndi", area: "beauty", leadDays: 90, when: (b) => wedding(b, "mehndi") },
    { id: "w_book_music", area: "entertainment", leadDays: 90 },
    { id: "w_block_rooms", area: "stay", leadDays: 90, when: (b) => b.guests >= 50 },
    { id: "w_choreo", area: "entertainment", leadDays: 75, when: (b) => wedding(b, "sangeet") },
    { id: "w_order_invites", area: "invitations", leadDays: 75 },
    { id: "w_send_invites", area: "invitations", leadDays: 45 },
    { id: "w_menu_tasting", area: "catering", leadDays: 30 },
    { id: "w_transport", area: "transport", leadDays: 30 },
    { id: "w_favours", area: "gifts", leadDays: 30 },
    { id: "w_trials", area: "beauty", leadDays: 21 },
    { id: "w_haldi_supplies", area: "rituals", leadDays: 14, when: (b) => wedding(b, "haldi") },
    { id: "w_final_count", area: "catering", leadDays: 10 },
    { id: "w_reconfirm", area: "planning", leadDays: 7 },
    { id: "w_emergency_kit", area: "planning", leadDays: 2 },
    { id: "w_day_contacts", area: "planning", leadDays: 1 },
  ],
  birthday: [
    { id: "b_guests_date", area: "planning", leadDays: 45 },
    { id: "b_book_venue", area: "venue", leadDays: 30 },
    {
      id: "b_memory_book",
      area: "photo",
      leadDays: 30,
      when: (b) => b.type === "birthday" && b.honoree === "milestone",
    },
    { id: "b_theme", area: "decor", leadDays: 28 },
    { id: "b_send_invites", area: "invitations", leadDays: 21 },
    { id: "b_entertainment", area: "entertainment", leadDays: 21 },
    { id: "b_caterer", area: "catering", leadDays: 14 },
    { id: "b_cake", area: "cake", leadDays: 10 },
    { id: "b_return_gifts", area: "gifts", leadDays: 10 },
    {
      id: "b_kid_safety",
      area: "planning",
      leadDays: 7,
      when: (b) => b.type === "birthday" && b.honoree === "child",
    },
    { id: "b_rsvp_count", area: "catering", leadDays: 5 },
    { id: "b_playlist_photos", area: "photo", leadDays: 3 },
    { id: "b_setup", area: "decor", leadDays: 1 },
  ],
  community: [
    { id: "c_committee", area: "planning", leadDays: 60 },
    { id: "c_budget_sponsors", area: "planning", leadDays: 56 },
    { id: "c_book_ground", area: "venue", leadDays: 45 },
    { id: "c_police_permission", area: "permits", leadDays: 30 },
    { id: "c_local_permission", area: "permits", leadDays: 30 },
    { id: "c_sound_stage", area: "entertainment", leadDays: 30 },
    { id: "c_food", area: "catering", leadDays: 21 },
    { id: "c_publicity", area: "publicity", leadDays: 21 },
    {
      id: "c_rehearsals",
      area: "entertainment",
      leadDays: 21,
      when: (b) => b.type === "community" && b.kind === "cultural",
    },
    {
      id: "c_puja",
      area: "decor",
      leadDays: 14,
      when: (b) => b.type === "community" && b.kind === "festival",
    },
    {
      id: "c_donations",
      area: "publicity",
      leadDays: 14,
      when: (b) => b.type === "community" && b.kind === "fundraiser",
    },
    {
      id: "c_prizes",
      area: "gifts",
      leadDays: 14,
      when: (b) => b.type === "community" && b.kind === "sports",
    },
    { id: "c_volunteers", area: "transport", leadDays: 14 },
    { id: "c_fire_safety", area: "permits", leadDays: 14 },
    {
      id: "c_cleanup_kit",
      area: "sanitation",
      leadDays: 10,
      when: (b) => b.type === "community" && b.kind === "cleanup",
    },
    { id: "c_first_aid", area: "permits", leadDays: 7 },
    { id: "c_waste", area: "sanitation", leadDays: 7 },
    { id: "c_walkthrough", area: "planning", leadDays: 1 },
  ],
};

/** Every template task id, so translations can be checked for completeness. */
export const TASK_IDS = Object.values(TASKS).flatMap((list) => list.map((t) => t.id));

/** Google Maps search phrases for finding vendors near the event city. */
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
    rituals: "pandit for wedding",
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
