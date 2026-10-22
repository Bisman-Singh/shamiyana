import "server-only";
import {
  generateText,
  NoObjectGeneratedError,
  Output,
  streamText,
  toTextStream,
  type ModelMessage,
  type OutputInterface,
  type TextStreamPart,
  type ToolSet,
} from "ai";
import { planBudget } from "@/lib/plan/budget";
import { shiftableCategories } from "@/lib/plan/catalog";
import { parseChanges, type Change } from "@/lib/plan/changes";
import { LIMITS, type Locale } from "@/lib/plan/constants";
import { isEmptyEnrichment, sanitizeEnrichment } from "@/lib/plan/enrichment";
import { parseObject, type Loose } from "@/lib/plan/loose";
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

/**
 * Output caps, deadlines and temperature per route: the model can't run long
 * or write a novel on our key. Ideas get room to vary; changes stay literal.
 */
export const AI_LIMITS = {
  plan: { maxOutputTokens: 4_000, totalMs: 50_000, firstChunkMs: 15_000, temperature: 0.8 },
  refine: { maxOutputTokens: 1_500, totalMs: 30_000, temperature: 0.4 },
  vision: { maxOutputTokens: 1_500, totalMs: 40_000, temperature: 0.5 },
} as const;

export interface RunContext {
  chain: readonly ModelSpec[];
  signal: AbortSignal;
  onFail?: (model: string) => void;
  /** A stream that had started ended without finishing, while the client was still connected. */
  onCutOff?: (model: string) => void;
}

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

interface Generation<T> {
  output: OutputInterface;
  instructions: string;
  input: { prompt: string } | { messages: ModelMessage[] };
  limits: { maxOutputTokens: number; totalMs: number; temperature: number };
  /** Turns the parsed reply into the answer, or throws so the next model gets a turn. */
  read: (raw: Loose) => T;
}

/** One structured answer from the first model whose reply reads as usable. */
async function generateSanitized<T>(
  ctx: RunContext,
  g: Generation<T>,
): Promise<(T & { model: string }) | null> {
  const result = await firstSuccess(
    ctx.chain.map((spec) => ({
      id: spec.id,
      run: async () => {
        const text = await generatedText(() =>
          generateText({
            model: spec.model,
            providerOptions: spec.providerOptions,
            output: g.output,
            instructions: g.instructions,
            ...g.input,
            maxOutputTokens: g.limits.maxOutputTokens,
            temperature: g.limits.temperature,
            maxRetries: 1,
            abortSignal: ctx.signal,
            timeout: g.limits.totalMs,
          }),
        );
        return g.read(parseObject(text));
      },
    })),
    ctx.onFail,
  );
  return result ? { ...result.value, model: result.id } : null;
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
        temperature: AI_LIMITS.plan.temperature,
        maxRetries: 1,
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
  return generateSanitized(ctx, {
    output: Output.object({ schema: refineOutputSchema }),
    instructions: refineSystem(input.locale),
    input: { prompt: refinePrompt(input, lines) },
    limits: AI_LIMITS.refine,
    read: (raw) => {
      const reply = clip(raw.reply, LIMITS.replyMax);
      if (reply === "") throw new Error("empty_reply");
      const categories = lines.map((l) => l.category);
      return { reply, changes: parseChanges(raw.changes, categories, input.today) };
    },
  });
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
