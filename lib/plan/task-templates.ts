import type { CommunityKind, EventType, Honoree, TaskArea, WeddingFunction } from "./constants";
import type { EventFacts } from "./schema";

/**
 * The jobs each kind of event needs and how far ahead, as data. Code turns
 * this into the back-scheduled timeline; the model may only add a few tasks.
 */

/** A job most events of a type need, and how far ahead it is ideally done. */
export interface TaskTemplate {
  id: string;
  area: TaskArea;
  /** Days before the event this is ideally done by. */
  leadDays: number;
  when?: (facts: EventFacts) => boolean;
}

/** Whether a wedding includes this function. */
const hasFunction = (facts: EventFacts, fn: WeddingFunction) =>
  facts.type === "wedding" && facts.functions.includes(fn);

/** Whether a birthday is for this kind of honoree. */
const isBirthdayFor = (facts: EventFacts, honoree: Honoree) =>
  facts.type === "birthday" && facts.honoree === honoree;

/** Whether a community event is of this kind. */
const isCommunityKind = (facts: EventFacts, kind: CommunityKind) =>
  facts.type === "community" && facts.kind === kind;

/** The checklist per event type, longest lead first; a task with `when` applies only to some events. */
export const TASKS: Record<EventType, readonly TaskTemplate[]> = {
  wedding: [
    { id: "w_budget_guests", area: "planning", leadDays: 300 },
    { id: "w_book_venue", area: "venue", leadDays: 240 },
    { id: "w_roka", area: "rituals", leadDays: 200, when: (facts) => hasFunction(facts, "roka") },
    { id: "w_book_caterer", area: "catering", leadDays: 180 },
    { id: "w_book_photo", area: "photo", leadDays: 180 },
    {
      id: "w_book_reception",
      area: "venue",
      leadDays: 180,
      when: (facts) => hasFunction(facts, "reception"),
    },
    { id: "w_book_decor", area: "decor", leadDays: 150 },
    {
      id: "w_book_priest",
      area: "rituals",
      leadDays: 150,
      when: (facts) => hasFunction(facts, "wedding"),
    },
    { id: "w_outfits", area: "attire", leadDays: 120 },
    { id: "w_book_makeup", area: "beauty", leadDays: 120 },
    {
      id: "w_book_mehndi",
      area: "beauty",
      leadDays: 90,
      when: (facts) => hasFunction(facts, "mehndi"),
    },
    { id: "w_book_music", area: "entertainment", leadDays: 90 },
    { id: "w_block_rooms", area: "stay", leadDays: 90, when: (facts) => facts.guests >= 50 },
    { id: "w_transport", area: "transport", leadDays: 90 },
    { id: "w_save_date", area: "invitations", leadDays: 90, when: (facts) => facts.guests >= 50 },
    {
      id: "w_choreo",
      area: "entertainment",
      leadDays: 75,
      when: (facts) => hasFunction(facts, "sangeet"),
    },
    { id: "w_order_invites", area: "invitations", leadDays: 75 },
    { id: "w_tent_power", area: "venue", leadDays: 60 },
    {
      id: "w_registration",
      area: "planning",
      leadDays: 60,
      when: (facts) => hasFunction(facts, "wedding"),
    },
    { id: "w_send_invites", area: "invitations", leadDays: 45 },
    { id: "w_menu_tasting", area: "catering", leadDays: 30 },
    { id: "w_favours", area: "gifts", leadDays: 30 },
    { id: "w_trials", area: "beauty", leadDays: 21 },
    { id: "w_parking_security", area: "transport", leadDays: 21 },
    {
      id: "w_haldi_supplies",
      area: "rituals",
      leadDays: 14,
      when: (facts) => hasFunction(facts, "haldi"),
    },
    { id: "w_final_count", area: "catering", leadDays: 10 },
    { id: "w_reconfirm", area: "planning", leadDays: 7 },
    {
      id: "w_shagun_keeper",
      area: "planning",
      leadDays: 3,
      when: (facts) => hasFunction(facts, "wedding"),
    },
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
      when: (facts) => isBirthdayFor(facts, "milestone"),
    },
    { id: "b_theme", area: "decor", leadDays: 28 },
    { id: "b_send_invites", area: "invitations", leadDays: 21 },
    { id: "b_entertainment", area: "entertainment", leadDays: 21 },
    {
      id: "b_elder_access",
      area: "venue",
      leadDays: 21,
      when: (facts) => isBirthdayFor(facts, "milestone"),
    },
    { id: "b_caterer", area: "catering", leadDays: 14 },
    { id: "b_cake", area: "cake", leadDays: 10 },
    { id: "b_return_gifts", area: "gifts", leadDays: 10 },
    {
      id: "b_kid_safety",
      area: "planning",
      leadDays: 7,
      when: (facts) => isBirthdayFor(facts, "child"),
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
    { id: "c_fire_safety", area: "permits", leadDays: 30 },
    { id: "c_power", area: "venue", leadDays: 30 },
    {
      id: "c_stalls",
      area: "venue",
      leadDays: 30,
      when: (facts) => isCommunityKind(facts, "festival"),
    },
    { id: "c_sound_stage", area: "entertainment", leadDays: 30 },
    { id: "c_food", area: "catering", leadDays: 21 },
    { id: "c_publicity", area: "publicity", leadDays: 21 },
    {
      id: "c_rehearsals",
      area: "entertainment",
      leadDays: 21,
      when: (facts) => isCommunityKind(facts, "cultural"),
    },
    {
      id: "c_puja",
      area: "rituals",
      leadDays: 14,
      when: (facts) => isCommunityKind(facts, "festival"),
    },
    {
      id: "c_donations",
      area: "publicity",
      leadDays: 14,
      when: (facts) => isCommunityKind(facts, "fundraiser"),
    },
    {
      id: "c_prizes",
      area: "gifts",
      leadDays: 14,
      when: (facts) => isCommunityKind(facts, "sports"),
    },
    { id: "c_volunteers", area: "transport", leadDays: 14 },
    {
      id: "c_cleanup_kit",
      area: "sanitation",
      leadDays: 10,
      when: (facts) => isCommunityKind(facts, "cleanup"),
    },
    { id: "c_toilets_water", area: "sanitation", leadDays: 10 },
    { id: "c_first_aid", area: "permits", leadDays: 7 },
    { id: "c_waste", area: "sanitation", leadDays: 7 },
    { id: "c_help_desk", area: "permits", leadDays: 7, when: (facts) => facts.guests >= 300 },
    { id: "c_walkthrough", area: "planning", leadDays: 1 },
  ],
};

/** The template tasks that apply to this event. */
export function tasksFor(facts: EventFacts): readonly TaskTemplate[] {
  return TASKS[facts.type].filter((task) => (task.when ? task.when(facts) : true));
}

/** Every template task id, so translations can be checked for completeness. */
export const TASK_IDS = Object.values(TASKS).flatMap((list) => list.map((task) => task.id));
