import "server-only";
import { createGoogle } from "@ai-sdk/google";
import type { LanguageModel, streamText } from "ai";
import type { ServerEnv } from "@/lib/server/env";

type ProviderOptions = NonNullable<Parameters<typeof streamText>[0]["providerOptions"]>;

export interface ModelSpec {
  id: string;
  model: LanguageModel;
  providerOptions: ProviderOptions;
}

/**
 * Provider options per model. The default chain is Gemini 3, which takes a
 * thinking level left at the provider's default. A Gemini 2.5 model set in
 * GEMINI_MODELS thinks by default, so it gets a budget of 0 to stay fast.
 */
export function providerOptionsFor(id: string): ProviderOptions {
  return id.startsWith("gemini-2.5") ? { google: { thinkingConfig: { thinkingBudget: 0 } } } : {};
}

/** The fallback chain from config, or null when no key is set and AI is off. */
export function buildChain(
  env: Pick<ServerEnv, "GOOGLE_GENERATIVE_AI_API_KEY" | "GEMINI_MODELS">,
): ModelSpec[] | null {
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (apiKey === undefined) return null;
  const google = createGoogle({ apiKey });
  return env.GEMINI_MODELS.map((id) => ({
    id,
    model: google(id),
    providerOptions: providerOptionsFor(id),
  }));
}
