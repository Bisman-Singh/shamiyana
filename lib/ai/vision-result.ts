import { z } from "zod";
import { IDEA_AREAS, LIMITS } from "@/lib/plan/constants";
import { isRecord, oneOf, records, texts, uniqueBy } from "@/lib/plan/loose";
import { clip } from "@/lib/plan/text";
import { redact } from "./redact";
import { VISION_KINDS } from "./schemas";

const VISION_LIMITS = { mood: 200, colourName: 30, colours: 5, ideas: 5, note: 200, notes: 3 };
const V = VISION_LIMITS;

/** Photo insights as the client receives them: bounded, with colours as checked hex codes. */
export const visionResultSchema = z.strictObject({
  kind: z.enum(VISION_KINDS),
  mood: z.string().max(V.mood),
  palette: z
    .array(
      z.strictObject({
        name: z.string().max(V.colourName),
        hex: z.string().regex(/^#[0-9a-f]{6}$/),
      }),
    )
    .max(V.colours),
  ideas: z
    .array(
      z.strictObject({
        area: z.enum(IDEA_AREAS),
        title: z.string().max(LIMITS.ideaTitleMax),
        detail: z.string().max(LIMITS.ideaDetailMax),
      }),
    )
    .max(V.ideas),
  notes: z.array(z.string().max(V.note)).max(V.notes),
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

export function sanitizeVision(raw: unknown): VisionResult {
  const value = isRecord(raw) ? raw : {};
  return {
    kind: oneOf(value.kind, VISION_KINDS) ?? "other",
    mood: clip(scrub(value.mood), V.mood),
    palette: uniqueBy(
      records(value.palette)
        .map((c) => ({ name: clip(c.name, V.colourName), hex: hex(c.hex) }))
        .filter((c): c is { name: string; hex: string } => c.hex !== null),
      (c) => c.hex,
    ).slice(0, V.colours),
    ideas: uniqueBy(
      records(value.ideas)
        .map((i) => ({
          area: oneOf(i.area, IDEA_AREAS) ?? "decor",
          title: clip(scrub(i.title), LIMITS.ideaTitleMax),
          detail: clip(scrub(i.detail), LIMITS.ideaDetailMax),
        }))
        .filter((i) => i.title !== ""),
      (i) => i.title,
    ).slice(0, V.ideas),
    notes: texts(Array.isArray(value.notes) ? value.notes.map(scrub) : [], V.note, V.notes),
  };
}
