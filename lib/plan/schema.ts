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

const isoDate = z.string().refine(isIsoDate, { message: "invalid_date" });
const id = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

const briefBase = {
  title: line(1, LIMITS.titleMax),
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

export const briefSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("wedding"), ...briefBase, functions }),
  z.strictObject({ type: z.literal("birthday"), ...briefBase, honoree: z.enum(HONOREES) }),
  z.strictObject({ type: z.literal("community"), ...briefBase, kind: z.enum(COMMUNITY_KINDS) }),
]);
export type Brief = z.infer<typeof briefSchema>;

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
  title: line(1, 120),
  area: z.enum([...CATEGORY_IDS, "planning"]),
  leadDays: z.int().min(0).max(LIMITS.maxDaysAhead),
  source: z.enum(["custom", "ai"]),
});
export type CustomTask = z.infer<typeof customTaskSchema>;

export const savedIdeaSchema = z.strictObject({
  id,
  area: z.enum(IDEA_AREAS),
  title: line(1, 80),
  detail: line(0, 300),
});
export type SavedIdea = z.infer<typeof savedIdeaSchema>;

const rupees = z.int().min(0).max(LIMITS.budgetMax);

export const vendorProgressSchema = z.strictObject({
  status: z.enum(VENDOR_STATUSES),
  quote: rupees,
  paid: rupees,
  note: line(0, 200),
});
export type VendorProgress = z.infer<typeof vendorProgressSchema>;

export const planRecordSchema = z.strictObject({
  id,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  brief: briefSchema,
  enrichment: enrichmentSchema.nullable(),
  /** The brief and language the stored ideas were written for; a different brief means they are stale. */
  enrichedFor: z.strictObject({ brief: briefSchema, locale: z.enum(LOCALES) }).nullable(),
  factors: z.partialRecord(z.enum(CATEGORY_IDS), z.number().min(0.5).max(1.5)),
  tasks: z.array(customTaskSchema).max(LIMITS.customTasksMax),
  hidden: z.array(id).max(200),
  done: z.array(id).max(400),
  vendors: z.partialRecord(z.enum(CATEGORY_IDS), vendorProgressSchema),
  ideas: z.array(savedIdeaSchema).max(40),
  guests: z.array(guestSchema).max(LIMITS.guestListMax),
});
export type PlanRecord = z.infer<typeof planRecordSchema>;

export const storeSchema = z.strictObject({
  version: z.literal(1),
  activeId: id.nullable(),
  plans: z.array(planRecordSchema).max(LIMITS.plansMax),
});
export type Store = z.infer<typeof storeSchema>;
