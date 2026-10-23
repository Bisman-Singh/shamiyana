import "server-only";
import { Output, streamText, toTextStream, type TextStreamPart, type ToolSet } from "ai";
import { planBudget } from "@/lib/plan/budget";
import { shiftableCategories } from "@/lib/plan/catalog";
import type { Locale } from "@/lib/plan/constants";
import { isEmptyEnrichment, sanitizeEnrichment } from "@/lib/plan/enrichment";
import type { EventFacts } from "@/lib/plan/schema";
import { parseObject } from "@/lib/shared/untrusted";
import { cacheKey, type AnswerCache } from "./cache";
import { firstWorking } from "./fallback";
import { PROMPT_VERSION, planPrompt, planSystem } from "./prompts";
import { AI_LIMITS, type RunContext } from "./run";
import { enrichmentOutputSchema } from "./schemas";

type Part = TextStreamPart<ToolSet>;

/**
 * Passes stream parts through and reports a stream that ends on an error or
 * on anything but a normal stop. The SDK writes its own finish part when a
 * provider stream just ends or hits the token cap, so its reason is what
 * counts. A client that leaves cancels the stream instead and is not reported.
 */
function watchEnd(report: () => void): TransformStream<Part, Part> {
  let failed = false;
  let finished = false;
  return new TransformStream<Part, Part>({
    transform(part, controller) {
      if (part.type === "error" || part.type === "abort") failed = true;
      if (part.type === "finish") finished = part.finishReason === "stop";
      controller.enqueue(part);
    },
    flush() {
      if (failed || !finished) report();
    },
  });
}

/** A stream with one chunk, for answers served from the cache. */
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
  facts: EventFacts,
): TransformStream<string, string> {
  let text = "";
  return new TransformStream<string, string>({
    transform(chunk, controller) {
      text += chunk;
      controller.enqueue(chunk);
    },
    flush() {
      const clean = sanitizeEnrichment(parseObject(text), shiftableCategories(facts));
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

/** Streams a plan answer from the first working model and caches it once it is complete and usable. */
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
        temperature: AI_LIMITS.plan.temperature,
        maxRetries: 0,
        abortSignal: ctx.signal,
        timeout: { totalMs: AI_LIMITS.plan.totalMs, firstChunkMs: AI_LIMITS.plan.firstChunkMs },
        onError: () => undefined,
      }).stream,
  }));
  const opened = await firstWorking<Part>(
    attempts,
    {
      isContent: (p) => p.type === "text-delta",
      isError: (p) => p.type === "error" || p.type === "abort",
    },
    ctx.onFail,
  );
  if (!opened) return null;
  const parts = opened.stream.pipeThrough(
    watchEnd(() => {
      if (!ctx.signal.aborted) ctx.onCutOff?.(opened.id);
    }),
  );
  return {
    stream: toTextStream({ stream: parts }).pipeThrough(cacheWhenComplete(cache, key, input.facts)),
    model: opened.id,
  };
}
