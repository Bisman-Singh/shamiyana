import "server-only";
import { createGoogle } from "@ai-sdk/google";
import type { LanguageModel, streamText } from "ai";

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

/** The two settings the chain is built from, as the server's validated config names them. */
export interface ChainConfig {
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  GEMINI_MODELS: readonly string[];
}

/** The fallback chain from config, or null when no key is set and AI is off. */
export function buildChain(env: ChainConfig): ModelSpec[] | null {
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (apiKey === undefined) return null;
  const google = createGoogle({ apiKey });
  return env.GEMINI_MODELS.map((id) => ({
    id,
    model: google(id),
    providerOptions: providerOptionsFor(id),
  }));
}
