import { z } from "zod";
import { IDEA_AREAS, LIMITS } from "@/lib/plan/constants";
import { clip } from "@/lib/shared/plain-text";
import { isRecord, oneOf, records, texts, uniqueBy } from "@/lib/shared/untrusted";
import { redact } from "@/lib/ai/redact";
import { VISION_KINDS } from "./output-schemas";

const VISION_LIMITS = { mood: 200, colourName: 30, colours: 5, ideas: 5, note: 200, notes: 3 };

/** Photo insights as the client receives them: bounded, with colours as checked hex codes. */
export const visionResultSchema = z.strictObject({
  kind: z.enum(VISION_KINDS),
  mood: z.string().max(VISION_LIMITS.mood),
  palette: z
    .array(
      z.strictObject({
        name: z.string().max(VISION_LIMITS.colourName),
        hex: z.string().regex(/^#[0-9a-f]{6}$/),
      }),
    )
    .max(VISION_LIMITS.colours),
  ideas: z
    .array(
      z.strictObject({
        area: z.enum(IDEA_AREAS),
        title: z.string().max(LIMITS.ideaTitleMax),
        detail: z.string().max(LIMITS.ideaDetailMax),
      }),
    )
    .max(VISION_LIMITS.ideas),
  notes: z.array(z.string().max(VISION_LIMITS.note)).max(VISION_LIMITS.notes),
});
export type VisionResult = z.infer<typeof visionResultSchema>;

/** Photos of invitations carry phone numbers and emails; strip any the model repeats. */
function scrub(value: unknown): unknown {
  return typeof value === "string" ? redact(value) : value;
}

function hex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value.trim());
  return match?.[1] ? `#${match[1].toLowerCase()}` : null;
}

/** A photo answer cut to size: an unknown kind reads as other, an unknown area as decor, and bad colours are dropped. */
export function sanitizeVision(raw: unknown): VisionResult {
  const value = isRecord(raw) ? raw : {};
  return {
    kind: oneOf(value.kind, VISION_KINDS) ?? "other",
    mood: clip(scrub(value.mood), VISION_LIMITS.mood),
    palette: uniqueBy(
      records(value.palette)
        .map((colour) => ({
          name: clip(colour.name, VISION_LIMITS.colourName),
          hex: hex(colour.hex),
        }))
        .filter((colour): colour is { name: string; hex: string } => colour.hex !== null),
      (colour) => colour.hex,
    ).slice(0, VISION_LIMITS.colours),
    ideas: uniqueBy(
      records(value.ideas)
        .map((idea) => ({
          area: oneOf(idea.area, IDEA_AREAS) ?? "decor",
          title: clip(scrub(idea.title), LIMITS.ideaTitleMax),
          detail: clip(scrub(idea.detail), LIMITS.ideaDetailMax),
        }))
        .filter((idea) => idea.title !== ""),
      (idea) => idea.title,
    ).slice(0, VISION_LIMITS.ideas),
    notes: texts(
      Array.isArray(value.notes) ? value.notes.map(scrub) : [],
      VISION_LIMITS.note,
      VISION_LIMITS.notes,
    ),
  };
}
