import "server-only";
import { Output } from "ai";
import { planBudget } from "@/lib/plan/budget";
import { parseChanges, type Change } from "@/lib/plan/changes";
import { LIMITS, type Locale } from "@/lib/plan/constants";
import { clip } from "@/lib/shared/plain-text";
import { refinePrompt, refineSystem, type RefineContext } from "./prompts";
import { AI_LIMITS, generateSanitized, type RunContext } from "./run";
import { refineOutputSchema } from "@/lib/api/output-schemas";

/** What the refine route runs on: the prompt's context plus the reply language. */
export interface RefineInput extends RefineContext {
  locale: Locale;
}

/** `model` names who wrote the reply, for the log line; it is not sent to the page. */
export interface RefineAnswer {
  reply: string;
  changes: Change[];
  model: string;
}

/** One refine answer: a reply and the changes that pass validation. */
export async function runRefine(ctx: RunContext, input: RefineInput): Promise<RefineAnswer | null> {
  const lines = planBudget(input.facts, input.factors);
  return generateSanitized(ctx, {
    output: Output.object({ schema: refineOutputSchema }),
    instructions: refineSystem(input.locale),
    input: { prompt: refinePrompt(input, lines) },
    limits: AI_LIMITS.refine,
    read: (raw) => {
      const reply = clip(raw.reply, LIMITS.replyMax);
      if (reply === "") throw new Error("empty_reply");
      const categories = lines.map((line) => line.category);
      return { reply, changes: parseChanges(raw.changes, categories, input.today) };
    },
  });
}
