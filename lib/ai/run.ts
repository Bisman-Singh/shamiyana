import "server-only";
import { generateText, NoObjectGeneratedError, type ModelMessage, type OutputInterface } from "ai";
import { parseObject, type Loose } from "@/lib/shared/untrusted";
import { firstSuccess } from "./fallback";
import type { ModelSpec } from "./models";

/**
 * Output caps, deadlines and temperature per route: the model can't run long
 * or write a novel on our key. Ideas get room to vary; changes stay literal.
 */
export const AI_LIMITS = {
  plan: { maxOutputTokens: 4_000, totalMs: 50_000, firstChunkMs: 15_000, temperature: 0.8 },
  refine: { maxOutputTokens: 1_500, totalMs: 30_000, temperature: 0.4 },
  vision: { maxOutputTokens: 1_500, totalMs: 40_000, temperature: 0.5 },
} as const;

/** What a runner gets from its route: the models in order, the request's signal and log hooks. */
export interface RunContext {
  chain: readonly ModelSpec[];
  signal: AbortSignal;
  onFail?: (model: string) => void;
  /** A stream that had started ended without finishing, while the client was still connected. */
  onCutOff?: (model: string) => void;
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
export async function generateSanitized<T>(
  ctx: RunContext,
  generation: Generation<T>,
): Promise<(T & { model: string }) | null> {
  const result = await firstSuccess(
    ctx.chain.map((spec) => ({
      id: spec.id,
      run: async () => {
        const text = await generatedText(() =>
          generateText({
            model: spec.model,
            providerOptions: spec.providerOptions,
            output: generation.output,
            instructions: generation.instructions,
            ...generation.input,
            maxOutputTokens: generation.limits.maxOutputTokens,
            temperature: generation.limits.temperature,
            maxRetries: 0,
            abortSignal: ctx.signal,
            timeout: generation.limits.totalMs,
          }),
        );
        return generation.read(parseObject(text));
      },
    })),
    ctx.onFail,
  );
  return result ? { ...result.value, model: result.id } : null;
}
