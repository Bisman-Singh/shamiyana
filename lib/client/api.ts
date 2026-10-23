import { z } from "zod";
import { visionResultSchema, type VisionResult } from "@/lib/ai/vision-result";
import { parseChanges, type Change } from "@/lib/plan/changes";
import { LIMITS, type CategoryId } from "@/lib/plan/constants";
import type { refineRequestSchema } from "@/lib/api/contracts";
import { isRecord } from "@/lib/shared/untrusted";

/**
 * Browser calls to the AI routes. Every failure becomes one of the error
 * codes the dictionary has words for, and every answer is validated again
 * here: the browser trusts the server about as far as the server trusts
 * the model.
 */

const API_ERRORS = [
  "ai_unavailable",
  "rate_limited",
  "daily_cap",
  "ai_failed",
  "invalid",
  "network",
] as const;
export type ApiError = (typeof API_ERRORS)[number];

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** Maps an error body or status to a known code. */
export function errorCode(body: unknown, status: number): ApiError {
  const code = isRecord(body) ? body.error : undefined;
  const known = API_ERRORS.find((e) => e === code);
  if (known) return known;
  if (status === 429) return "rate_limited";
  if (status >= 400 && status < 500) return "invalid";
  return "ai_failed";
}

/** The error code inside an error thrown by `useObject`, whose message is the response body. */
export function errorFromMessage(message: string): ApiError {
  try {
    return errorCode(JSON.parse(message), 500);
  } catch {
    return "network";
  }
}

async function send(path: string, init: RequestInit): Promise<ApiResult<unknown>> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, credentials: "same-origin" });
  } catch {
    return { ok: false, error: "network" };
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, error: errorCode(body, response.status) };
  return { ok: true, data: body };
}

const refineAnswer = z.object({
  reply: z.string().max(LIMITS.replyMax),
  changes: z.array(z.unknown()),
});

/** The refine route's body, as its own schema reads it, so the page can't send something else. */
export type RefineRequest = z.input<ReturnType<typeof refineRequestSchema>>;

export interface RefineReply {
  reply: string;
  changes: Change[];
}

/** Sends a refine message and returns the reply with only the changes this plan allows. */
export async function requestRefine(
  body: RefineRequest,
  categories: readonly CategoryId[],
  today: string,
  signal?: AbortSignal,
): Promise<ApiResult<RefineReply>> {
  const result = await send("/api/refine", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!result.ok) return result;
  const parsed = refineAnswer.safeParse(result.data);
  if (!parsed.success) return { ok: false, error: "ai_failed" };
  return {
    ok: true,
    data: {
      reply: parsed.data.reply,
      changes: parseChanges(parsed.data.changes, categories, today),
    },
  };
}

/** Sends a photo for ideas and returns them sanitized. */
export async function requestVision(
  form: FormData,
  signal?: AbortSignal,
): Promise<ApiResult<VisionResult>> {
  const result = await send("/api/vision", { method: "POST", body: form, signal });
  if (!result.ok) return result;
  const parsed = visionResultSchema.safeParse(result.data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: "ai_failed" };
}
