import "server-only";
import { z } from "zod";
import { CATEGORY_IDS, LIMITS, LOCALES } from "@/lib/plan/constants";
import { daysBetween, isIsoDate } from "@/lib/plan/dates";
import { briefSchema } from "@/lib/plan/schema";
import { cleanText } from "@/lib/plan/text";

/**
 * Request bodies, strict: unknown keys are rejected, every string bounded.
 * `today` comes from the user's device so "days to go" matches their
 * calendar, but must sit within a day of the server's UTC date, and the
 * event must not be in the past or more than three years out.
 */

function dated(serverNow: Date) {
  const utc = serverNow.toISOString().slice(0, 10);
  return z
    .string()
    .refine(isIsoDate, { message: "invalid_date", abort: true })
    .refine((d) => Math.abs(daysBetween(utc, d)) <= 1, { message: "clock_skew" });
}

function withEventInRange(value: { today: string; brief: { date: string } }, ctx: z.RefinementCtx) {
  const ahead = daysBetween(value.today, value.brief.date);
  if (ahead < 0 || ahead > LIMITS.maxDaysAhead) {
    ctx.addIssue({ code: "custom", path: ["brief", "date"], message: "date_out_of_range" });
  }
}

export function planRequestSchema(serverNow: Date) {
  return z
    .strictObject({
      brief: briefSchema,
      locale: z.enum(LOCALES),
      today: dated(serverNow),
      fresh: z.boolean().default(false),
    })
    .superRefine(withEventInRange);
}

const turn = z.strictObject({
  role: z.enum(["user", "assistant"]),
  text: z
    .string()
    .transform((v) => cleanText(v))
    .pipe(z.string().min(1).max(600)),
});

export function refineRequestSchema(serverNow: Date) {
  return z
    .strictObject({
      brief: briefSchema,
      factors: z.partialRecord(z.enum(CATEGORY_IDS), z.number().min(0.5).max(1.5)),
      locale: z.enum(LOCALES),
      today: dated(serverNow),
      history: z.array(turn).max(6),
      message: z
        .string()
        .transform((v) => cleanText(v))
        .pipe(z.string().min(1).max(LIMITS.chatMessageMax)),
    })
    .superRefine(withEventInRange);
}

export function visionFieldsSchema(serverNow: Date) {
  return z
    .strictObject({
      brief: briefSchema,
      locale: z.enum(LOCALES),
      today: dated(serverNow),
    })
    .superRefine(withEventInRange);
}

export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/** The real image type from its first bytes; the declared type is never trusted. */
export function sniffImage(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  const b = (i: number) => bytes[i] ?? -1;
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((v, i) => b(i) === v)) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
