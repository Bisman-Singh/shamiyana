/** The closed vocabularies every plan, prompt and translation is keyed by. */

export const EVENT_TYPES = ["wedding", "birthday", "community"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const WEDDING_FUNCTIONS = [
  "roka",
  "haldi",
  "mehndi",
  "sangeet",
  "wedding",
  "reception",
] as const;
export type WeddingFunction = (typeof WEDDING_FUNCTIONS)[number];

export const HONOREES = ["child", "teen", "adult", "milestone"] as const;
export type Honoree = (typeof HONOREES)[number];

export const COMMUNITY_KINDS = ["festival", "cultural", "fundraiser", "sports", "cleanup"] as const;
export type CommunityKind = (typeof COMMUNITY_KINDS)[number];

export const STYLES = ["traditional", "modern", "minimal", "eco"] as const;
export type Style = (typeof STYLES)[number];

export const FOOD_PREFS = ["veg", "mixed", "jain"] as const;
export type FoodPref = (typeof FOOD_PREFS)[number];

export const CATEGORY_IDS = [
  "venue",
  "catering",
  "cake",
  "decor",
  "photo",
  "attire",
  "beauty",
  "entertainment",
  "invitations",
  "rituals",
  "transport",
  "stay",
  "gifts",
  "permits",
  "publicity",
  "sanitation",
  "contingency",
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

/** Tasks also belong to "planning", which has no budget line of its own. */
export const TASK_AREAS = ["planning", ...CATEGORY_IDS] as const;
export type TaskArea = (typeof TASK_AREAS)[number];

export const IDEA_AREAS = [
  "theme",
  "decor",
  "food",
  "activity",
  "music",
  "attire",
  "favours",
  "sustainability",
] as const;
export type IdeaArea = (typeof IDEA_AREAS)[number];

export const IDEA_COSTS = ["low", "medium", "high"] as const;

export const VENDOR_STATUSES = ["todo", "shortlisted", "booked", "paid"] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const RSVP_STATUSES = ["pending", "yes", "maybe", "no"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const DIETS = ["veg", "nonveg", "jain", "vegan"] as const;
export type Diet = (typeof DIETS)[number];

export const GUEST_GROUPS = ["family", "friends", "work", "neighbours", "other"] as const;
export type GuestGroup = (typeof GUEST_GROUPS)[number];

export const LOCALES = ["en", "hi"] as const;
export type Locale = (typeof LOCALES)[number];

/** Input bounds shared by the form, the API schemas and the prompts. */
export const LIMITS = {
  titleMax: 80,
  cityMax: 60,
  notesMax: 500,
  guestsMin: 1,
  guestsMax: 5000,
  budgetMin: 5_000,
  budgetMax: 50_00_00_000,
  maxDaysAhead: 3 * 366,
  guestNameMax: 80,
  partyMax: 20,
  guestListMax: 2000,
  customTasksMax: 60,
  plansMax: 20,
  chatMessageMax: 400,
  chatHistoryMax: 6,
  replyMax: 600,
  taskTitleMax: 120,
  ideaTitleMax: 80,
  ideaDetailMax: 300,
  savedIdeasMax: 40,
  vendorNoteMax: 200,
  weeksMax: 52,
  /** A budget line's weight: 1 is the standard share. */
  factorMin: 0.5,
  factorMax: 1.5,
} as const;
