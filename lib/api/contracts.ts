import { z } from "zod";
import { LIMITS, LOCALES, TURN_ROLES, type TurnRole } from "@/lib/plan/constants";
import { daysBetween, isIsoDate, utcDay } from "@/lib/plan/dates";
import { factorsSchema, factsSchema } from "@/lib/plan/schema";
import { cleanText } from "@/lib/shared/plain-text";

/**
 * Request bodies, strict: unknown keys are rejected, every string bounded.
 * `today` comes from the user's device so "days to go" matches their
 * calendar, but must sit within a day of the server's UTC date, and the
 * event must not be in the past or more than three years out.
 */

function dated(serverNow: Date) {
  const utc = utcDay(serverNow);
  return z
    .string()
    .refine(isIsoDate, { message: "invalid_date", abort: true })
    .refine((date) => Math.abs(daysBetween(utc, date)) <= 1, { message: "clock_skew" });
}

function withEventInRange(value: { today: string; facts: { date: string } }, ctx: z.RefinementCtx) {
  const ahead = daysBetween(value.today, value.facts.date);
  if (ahead < 0 || ahead > LIMITS.maxDaysAhead) {
    ctx.addIssue({ code: "custom", path: ["facts", "date"], message: "date_out_of_range" });
  }
}

/** The plan request: facts, language and the device's date within a day of the server's. */
export function planRequestSchema(serverNow: Date) {
  return z
    .strictObject({
      facts: factsSchema,
      locale: z.enum(LOCALES),
      today: dated(serverNow),
      fresh: z.boolean().default(false),
    })
    .superRefine(withEventInRange);
}

const turn = z.strictObject({
  role: z.enum(TURN_ROLES),
  text: z
    .string()
    .transform((text) => cleanText(text))
    .pipe(z.string().min(1).max(LIMITS.replyMax)),
});

/** The refine request: facts, weights, recent turns and the message, all bounded. */
export function refineRequestSchema(serverNow: Date) {
  return z
    .strictObject({
      facts: factsSchema,
      factors: factorsSchema,
      locale: z.enum(LOCALES),
      today: dated(serverNow),
      history: z.array(turn).max(LIMITS.chatHistoryMax),
      message: z
        .string()
        .transform((text) => cleanText(text))
        .pipe(z.string().min(1).max(LIMITS.chatMessageMax)),
    })
    .superRefine(withEventInRange);
}

/** The text part of a photo request. */
export function visionFieldsSchema(serverNow: Date) {
  return z
    .strictObject({
      facts: factsSchema,
      locale: z.enum(LOCALES),
      today: dated(serverNow),
    })
    .superRefine(withEventInRange);
}

/** One turn of the refine chat as the model sees it. */
export interface Turn {
  role: TurnRole;
  text: string;
}
