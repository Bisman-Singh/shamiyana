import { z } from "zod";
import { IDEA_AREAS } from "@/lib/plan/constants";
import { clip } from "@/lib/plan/text";
import { VISION_KINDS } from "./schemas";

/** Photo insights as the client receives them: bounded, with colours as checked hex codes. */
export const visionResultSchema = z.strictObject({
  kind: z.enum(VISION_KINDS),
  mood: z.string().max(200),
  palette: z
    .array(z.strictObject({ name: z.string().max(30), hex: z.string().regex(/^#[0-9a-f]{6}$/) }))
    .max(5),
  ideas: z
    .array(
      z.strictObject({
        area: z.enum(IDEA_AREAS),
        title: z.string().max(80),
        detail: z.string().max(300),
      }),
    )
    .max(5),
  notes: z.array(z.string().max(200)).max(3),
});
export type VisionResult = z.infer<typeof visionResultSchema>;

type Loose = Record<string, unknown>;
const records = (v: unknown): Loose[] =>
  Array.isArray(v) ? v.filter((x): x is Loose => typeof x === "object" && x !== null) : [];
const pick = <T extends string>(v: unknown, all: readonly T[], fallback: T): T =>
  all.find((a) => a === v) ?? fallback;

function hex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value.trim());
  return match?.[1] ? `#${match[1].toLowerCase()}` : null;
}

export function sanitizeVision(raw: unknown): VisionResult {
  const value: Loose = typeof raw === "object" && raw !== null ? (raw as Loose) : {};
  return {
    kind: pick(value.kind, VISION_KINDS, "other"),
    mood: clip(value.mood, 200),
    palette: records(value.palette)
      .map((c) => ({ name: clip(c.name, 30), hex: hex(c.hex) }))
      .filter((c): c is { name: string; hex: string } => c.hex !== null)
      .slice(0, 5),
    ideas: records(value.ideas)
      .map((i) => ({
        area: pick(i.area, IDEA_AREAS, "decor"),
        title: clip(i.title, 80),
        detail: clip(i.detail, 300),
      }))
      .filter((i) => i.title !== "")
      .slice(0, 5),
    notes: (Array.isArray(value.notes) ? value.notes : [])
      .map((n) => clip(n, 200))
      .filter((n) => n !== "")
      .slice(0, 3),
  };
}
