import "server-only";
import { Output } from "ai";
import { planBudget } from "@/lib/plan/budget";
import type { Locale } from "@/lib/plan/constants";
import type { EventFacts } from "@/lib/plan/schema";
import { visionPrompt, visionSystem } from "./prompts";
import { AI_LIMITS, generateSanitized, type RunContext } from "./run";
import { visionOutputSchema } from "./schemas";
import { sanitizeVision, type VisionResult } from "./vision-result";

/** `mediaType` is sniffed from the bytes, never the type the browser declared. */
export interface VisionInput {
  facts: EventFacts;
  locale: Locale;
  today: string;
  image: Uint8Array;
  mediaType: string;
}

/** One photo answer, sanitized. */
export async function runVision(
  ctx: RunContext,
  input: VisionInput,
): Promise<(VisionResult & { model: string }) | null> {
  const lines = planBudget(input.facts, {});
  return generateSanitized(ctx, {
    output: Output.object({ schema: visionOutputSchema }),
    instructions: visionSystem(input.locale),
    input: {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: visionPrompt(input.facts, lines, input.today) },
            { type: "file", mediaType: input.mediaType, data: input.image },
          ],
        },
      ],
    },
    limits: AI_LIMITS.vision,
    read: (raw) => {
      const clean = sanitizeVision(raw);
      if (clean.ideas.length === 0 && clean.palette.length === 0) throw new Error("empty_vision");
      return clean;
    },
  });
}
