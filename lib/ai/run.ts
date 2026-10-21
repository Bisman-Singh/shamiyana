import "server-only";
import {
  generateText,
  NoObjectGeneratedError,
  Output,
  streamText,
  toTextStream,
  type TextStreamPart,
  type ToolSet,
} from "ai";
import { planBudget } from "@/lib/plan/budget";
import { shiftableCategories } from "@/lib/plan/catalog";
import { parseChanges, type Change } from "@/lib/plan/changes";
import type { Locale } from "@/lib/plan/constants";
import { isEmptyEnrichment, sanitizeEnrichment } from "@/lib/plan/enrichment";
import type { EventFacts, PlanRecord } from "@/lib/plan/schema";
import { clip } from "@/lib/plan/text";
import { cacheKey, type AnswerCache } from "./cache";
import { firstSuccess, firstWorking } from "./fallback";
import type { ModelSpec } from "./models";
import {
  PROMPT_VERSION,
  planPrompt,
  planSystem,
  refinePrompt,
  refineSystem,
  visionPrompt,
  visionSystem,
  type Turn,
} from "./prompts";
import { enrichmentOutputSchema, refineOutputSchema, visionOutputSchema } from "./schemas";
import { sanitizeVision, type VisionResult } from "./vision-result";

/** Output caps and deadlines: the model can't run long or write a novel on our key. */
export const AI_LIMITS = {
  plan: { maxOutputTokens: 4_000, totalMs: 50_000, firstChunkMs: 15_000 },
  refine: { maxOutputTokens: 1_500, totalMs: 30_000 },
  vision: { maxOutputTokens: 1_500, totalMs: 40_000 },
} as const;

export interface RunContext {
  chain: readonly ModelSpec[];
  signal: AbortSignal;
  onFail?: (model: string) => void;
}

function parseObject(text: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * The model's raw text. A reply that misses the schema in some small way,
 * an unknown enum value say, is still useful once sanitized, so the text is
 * recovered from the SDK's no-object error instead of being thrown away.
 */
async function generatedText(call: () => Promise<{ text: string }>): Promise<string> {
  try {
    return (await call()).text;
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error) && error.text) return error.text;
    throw error;
  }
}

export function textStream(text: string): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      controller.enqueue(text);
      controller.close();
    },
  });
}

/** Passes text through and caches the whole answer once it has arrived complete and useful. */
function cacheWhenComplete(
  cache: AnswerCache,
  key: string,
  brief: EventFacts,
): TransformStream<string, string> {
  let text = "";
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      text += chunk;
      controller.enqueue(chunk);
    },
    flush() {
      const clean = sanitizeEnrichment(parseObject(text), shiftableCategories(brief));
      if (!isEmptyEnrichment(clean)) cache.set(key, text);
    },
  });
}

export interface PlanInput {
  facts: EventFacts;
  locale: Locale;
  today: string;
  fresh: boolean;
}

export interface PlanStream {
  stream: ReadableStream<string>;
  model: string;
}

/** The cache key for the event facts and a finished answer for it, if one is cached and still fresh. */
export async function lookupPlan(
  cache: AnswerCache,
  input: PlanInput,
): Promise<{ key: string; hit: string | null }> {
  const key = await cacheKey([PROMPT_VERSION, input.locale, input.today, input.facts]);
  return { key, hit: input.fresh ? null : cache.get(key) };
}

export async function streamPlan(
  ctx: RunContext,
  cache: AnswerCache,
  key: string,
  input: PlanInput,
): Promise<PlanStream | null> {
  const lines = planBudget(input.facts, {});
  const attempts = ctx.chain.map((spec) => ({
    id: spec.id,
    run: () =>
      streamText({
        model: spec.model,
        providerOptions: spec.providerOptions,
        output: Output.object({ schema: enrichmentOutputSchema }),
        instructions: planSystem(input.locale),
        prompt: planPrompt(input.facts, lines, input.today),
        maxOutputTokens: AI_LIMITS.plan.maxOutputTokens,
        temperature: 0.8,
        maxRetries: 1,
        abortSignal: ctx.signal,
        timeout: { totalMs: AI_LIMITS.plan.totalMs, firstChunkMs: AI_LIMITS.plan.firstChunkMs },
        onError: () => undefined,
      }).stream,
  }));
  const opened = await firstWorking<TextStreamPart<ToolSet>>(
    attempts,
    {
      isContent: (p) => p.type === "text-delta",
      isError: (p) => p.type === "error" || p.type === "abort",
    },
    ctx.onFail,
  );
  if (!opened) return null;
  return {
    stream: toTextStream({ stream: opened.stream }).pipeThrough(
      cacheWhenComplete(cache, key, input.facts),
    ),
    model: opened.id,
  };
}

export interface RefineInput {
  facts: EventFacts;
  factors: PlanRecord["factors"];
  locale: Locale;
  today: string;
  history: readonly Turn[];
  message: string;
}

export interface RefineAnswer {
  reply: string;
  changes: Change[];
  model: string;
}

export async function runRefine(ctx: RunContext, input: RefineInput): Promise<RefineAnswer | null> {
  const lines = planBudget(input.facts, input.factors);
  const result = await firstSuccess(
    ctx.chain.map((spec) => ({
      id: spec.id,
      run: async () => {
        const text = await generatedText(() =>
          generateText({
            model: spec.model,
            providerOptions: spec.providerOptions,
            output: Output.object({ schema: refineOutputSchema }),
            instructions: refineSystem(input.locale),
            prompt: refinePrompt(input.facts, lines, input.today, input.history, input.message),
            maxOutputTokens: AI_LIMITS.refine.maxOutputTokens,
            temperature: 0.4,
            maxRetries: 1,
            abortSignal: ctx.signal,
            timeout: AI_LIMITS.refine.totalMs,
          }),
        );
        const raw = parseObject(text);
        const reply = clip(raw.reply, 600);
        if (reply === "") throw new Error("empty_reply");
        return {
          reply,
          changes: parseChanges(
            raw.changes,
            lines.map((l) => l.category),
            input.today,
          ),
        };
      },
    })),
    ctx.onFail,
  );
  return result ? { ...result.value, model: result.id } : null;
}

export interface VisionInput {
  facts: EventFacts;
  locale: Locale;
  today: string;
  image: Uint8Array;
  mediaType: string;
}

export async function runVision(
  ctx: RunContext,
  input: VisionInput,
): Promise<(VisionResult & { model: string }) | null> {
  const lines = planBudget(input.facts, {});
  const result = await firstSuccess(
    ctx.chain.map((spec) => ({
      id: spec.id,
      run: async () => {
        const text = await generatedText(() =>
          generateText({
            model: spec.model,
            providerOptions: spec.providerOptions,
            output: Output.object({ schema: visionOutputSchema }),
            instructions: visionSystem(input.locale),
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: visionPrompt(input.facts, lines, input.today) },
                  { type: "file", mediaType: input.mediaType, data: input.image },
                ],
              },
            ],
            maxOutputTokens: AI_LIMITS.vision.maxOutputTokens,
            temperature: 0.5,
            maxRetries: 1,
            abortSignal: ctx.signal,
            timeout: AI_LIMITS.vision.totalMs,
          }),
        );
        const clean = sanitizeVision(parseObject(text));
        if (clean.ideas.length === 0 && clean.palette.length === 0) throw new Error("empty_vision");
        return clean;
      },
    })),
    ctx.onFail,
  );
  return result ? { ...result.value, model: result.id } : null;
}
