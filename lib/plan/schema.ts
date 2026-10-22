import { z } from "zod";
import {
  CATEGORY_IDS,
  COMMUNITY_KINDS,
  DIETS,
  FOOD_PREFS,
  GUEST_GROUPS,
  HONOREES,
  IDEA_AREAS,
  LIMITS,
  LOCALES,
  RSVP_STATUSES,
  TASK_AREAS,
  STYLES,
  VENDOR_STATUSES,
  WEDDING_FUNCTIONS,
} from "./constants";
import { isIsoDate } from "./dates";
import { enrichmentSchema } from "./enrichment";
import { cleanText } from "./text";

const line = (min: number, max: number) =>
  z
    .string()
    .transform((v) => cleanText(v))
    .pipe(z.string().min(min).max(max));

const isoDate = z.string().max(10).refine(isIsoDate, { message: "invalid_date", abort: true });
const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

const factsBase = {
  date: isoDate,
  city: line(2, LIMITS.cityMax),
  guests: z.int().min(LIMITS.guestsMin).max(LIMITS.guestsMax),
  budget: z.int().min(LIMITS.budgetMin).max(LIMITS.budgetMax),
  style: z.enum(STYLES),
  food: z.enum(FOOD_PREFS),
  notes: z
    .string()
    .transform((v) => cleanText(v, true))
    .pipe(z.string().max(LIMITS.notesMax)),
};

const functions = z
  .array(z.enum(WEDDING_FUNCTIONS))
  .min(1)
  .max(WEDDING_FUNCTIONS.length)
  .refine((list) => new Set(list).size === list.length, { message: "duplicate_function" });

const title = line(1, LIMITS.titleMax);
const variants = {
  wedding: { type: z.literal("wedding"), ...factsBase, functions },
  birthday: { type: z.literal("birthday"), ...factsBase, honoree: z.enum(HONOREES) },
  community: { type: z.literal("community"), ...factsBase, kind: z.enum(COMMUNITY_KINDS) },
};

/** Everything about the event the planner and the AI need. No title: it often holds a person's name. */
export const factsSchema = z.discriminatedUnion("type", [
  z.strictObject(variants.wedding),
  z.strictObject(variants.birthday),
  z.strictObject(variants.community),
]);
export type EventFacts = z.infer<typeof factsSchema>;

/** The facts plus the title the user sees. Only the facts ever leave the browser for the AI. */
export const briefSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...variants.wedding, title }),
  z.strictObject({ ...variants.birthday, title }),
  z.strictObject({ ...variants.community, title }),
]);
export type Brief = z.infer<typeof briefSchema>;

export function factsOf(brief: Brief): EventFacts {
  const { title, ...facts } = brief;
  return facts;
}

export const guestSchema = z.strictObject({
  id,
  name: line(1, LIMITS.guestNameMax),
  group: z.enum(GUEST_GROUPS),
  party: z.int().min(1).max(LIMITS.partyMax),
  rsvp: z.enum(RSVP_STATUSES),
  diet: z.enum(DIETS),
});
export type Guest = z.infer<typeof guestSchema>;

export const customTaskSchema = z.strictObject({
  id,
  title: line(1, LIMITS.taskTitleMax),
  area: z.enum(TASK_AREAS),
  leadDays: z.int().min(0).max(LIMITS.maxDaysAhead),
  source: z.enum(["custom", "ai"]),
});
export type CustomTask = z.infer<typeof customTaskSchema>;

const savedIdeaSchema = z.strictObject({
  id,
  area: z.enum(IDEA_AREAS),
  title: line(1, LIMITS.ideaTitleMax),
  detail: line(0, LIMITS.ideaDetailMax),
});
export type SavedIdea = z.infer<typeof savedIdeaSchema>;

const rupees = z.int().min(0).max(LIMITS.budgetMax);

/** The user's weight per budget line; a missing line means the standard 1. */
export const factorsSchema = z.partialRecord(
  z.enum(CATEGORY_IDS),
  z.number().min(LIMITS.factorMin).max(LIMITS.factorMax),
);

const vendorProgressSchema = z.strictObject({
  status: z.enum(VENDOR_STATUSES),
  quote: rupees,
  paid: rupees,
  note: line(0, LIMITS.vendorNoteMax),
});
export type VendorProgress = z.infer<typeof vendorProgressSchema>;

export const planRecordSchema = z.strictObject({
  id,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  brief: briefSchema,
  enrichment: enrichmentSchema.nullable(),
  /** The event facts and language the stored ideas were written for; different facts mean they are stale. */
  enrichedFor: z.strictObject({ facts: factsSchema, locale: z.enum(LOCALES) }).nullable(),
  factors: factorsSchema,
  tasks: z.array(customTaskSchema).max(LIMITS.customTasksMax),
  hidden: z.array(id).max(200),
  done: z.array(id).max(400),
  vendors: z.partialRecord(z.enum(CATEGORY_IDS), vendorProgressSchema),
  ideas: z.array(savedIdeaSchema).max(LIMITS.savedIdeasMax),
  guests: z.array(guestSchema).max(LIMITS.guestListMax),
});
export type PlanRecord = z.infer<typeof planRecordSchema>;

export const storeSchema = z.strictObject({
  version: z.literal(1),
  activeId: id.nullable(),
  plans: z.array(planRecordSchema).max(LIMITS.plansMax),
});
export type Store = z.infer<typeof storeSchema>;
