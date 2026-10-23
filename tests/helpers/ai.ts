import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { AnswerCache } from "@/lib/ai/cache";
import type { ModelSpec } from "@/lib/ai/models";
import type { RunContext } from "@/lib/ai/run";
import type { AiDeps } from "@/lib/server/deps";
import { DailyCap, RateLimiter } from "@/lib/server/rate-limit";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

/** A model that streams `text` in the given pieces. */
export function streamingModel(pieces: readonly string[]): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: () =>
      Promise.resolve({
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start" as const, id: "t" },
            ...pieces.map((delta) => ({ type: "text-delta" as const, id: "t", delta })),
            { type: "text-end" as const, id: "t" },
            {
              type: "finish" as const,
              finishReason: { unified: "stop" as const, raw: undefined },
              usage,
            },
          ],
        }),
      }),
  });
}

/**
 * A model whose stream starts and then stops early: on an error part, by
 * just ending ("silent"), or by hitting the output cap ("length").
 */
export function cutOffModel(
  pieces: readonly string[],
  ending: "error" | "silent" | "length" = "error",
  chunkDelayInMs = 0,
): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: () =>
      Promise.resolve({
        stream: simulateReadableStream({
          chunkDelayInMs,
          chunks: [
            { type: "text-start" as const, id: "t" },
            ...pieces.map((delta) => ({ type: "text-delta" as const, id: "t", delta })),
            ...(ending === "error"
              ? [{ type: "error" as const, error: new Error("upstream reset") }]
              : []),
            ...(ending === "length"
              ? [
                  {
                    type: "finish" as const,
                    finishReason: { unified: "length" as const, raw: undefined },
                    usage,
                  },
                ]
              : []),
          ],
        }),
      }),
  });
}

/** A model whose stream fails before any text. */
export function brokenStreamModel(): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doStream: () => Promise.reject(new Error("upstream 503")),
  });
}

export function generatingModel(text: string): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: () =>
      Promise.resolve({
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      }),
  });
}

/** A model that never answers, and gives up only when its call is aborted. */
export function hangingModel(): MockLanguageModelV4 {
  const wait = ({ abortSignal }: { abortSignal?: AbortSignal }) =>
    new Promise<never>((_resolve, reject) => {
      if (abortSignal?.aborted) reject(new Error("aborted"));
      abortSignal?.addEventListener("abort", () => {
        reject(new Error("aborted"));
      });
    });
  return new MockLanguageModelV4({ doGenerate: wait, doStream: wait });
}

export function brokenGenerateModel(): MockLanguageModelV4 {
  return new MockLanguageModelV4({ doGenerate: () => Promise.reject(new Error("upstream 500")) });
}

export function spec(model: MockLanguageModelV4, id = "mock-model"): ModelSpec {
  return { id, model, providerOptions: {} };
}

/** A chain of the given models, named m0, m1 and so on in order, with a signal nobody aborts. */
export function runContext(models: MockLanguageModelV4[]): RunContext {
  return {
    chain: models.map((model, index) => spec(model, `m${index}`)),
    signal: new AbortController().signal,
  };
}

export const FIXED_NOW = new Date("2026-10-21T10:00:00.000Z");

export function testDeps(chain: readonly ModelSpec[] | null, patch: Partial<AiDeps> = {}): AiDeps {
  return {
    chain,
    cache: new AnswerCache(),
    limiters: {
      plan: new RateLimiter({ limit: 100, windowMs: 60_000 }),
      refine: new RateLimiter({ limit: 100, windowMs: 60_000 }),
      vision: new RateLimiter({ limit: 100, windowMs: 60_000 }),
    },
    daily: new DailyCap({ cap: 1_000 }),
    now: () => FIXED_NOW,
    deadlineMs: 55_000,
    ...patch,
  };
}

export const SAME_ORIGIN = {
  "sec-fetch-site": "same-origin",
  origin: "https://plan.test",
  host: "plan.test",
};

export function jsonPost(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://plan.test/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...SAME_ORIGIN, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

export function formPost(form: FormData, headers: Record<string, string> = {}): Request {
  return new Request("https://plan.test/api/x", {
    method: "POST",
    headers: { ...SAME_ORIGIN, ...headers },
    body: form,
  });
}

/** The smallest valid images of each accepted type, by their signatures. */
export const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46]);
export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
export const WEBP = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");
