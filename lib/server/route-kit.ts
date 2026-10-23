import "server-only";
import type { z } from "zod";
import type { RunContext } from "@/lib/ai/run";
import type { AiDeps } from "./deps";
import {
  clientKey,
  errorResponse,
  guard,
  parseJson,
  type ErrorCode,
  type GuardOptions,
} from "./http";
import { logEvent, type AiRoute, type LogFields } from "./log";

/**
 * The steps every AI route shares: its log line per outcome, a wrapper that
 * turns anything unexpected into a bare 500, reading a JSON body, and the
 * check that the AI is on and today's allowance has room.
 */

/** Request body caps. The photo route's text part is capped on its own. */
export const BODY_LIMITS = {
  plan: 8_192,
  refine: 16_384,
  visionFields: 16_384,
} as const;

/** Logs one line per outcome for a request, each with the route and the time since it started. */
function reporter(route: AiRoute) {
  const started = Date.now();
  const emit = (fields: Omit<LogFields, "route" | "ms">) => {
    logEvent({ route, ms: Date.now() - started, ...fields });
  };
  return {
    fail: (code: ErrorCode, headers?: Record<string, string>): Response => {
      const response = errorResponse(code, headers);
      emit({ outcome: code, status: response.status });
      return response;
    },
    ok: (response: Response, model: string, cached = false): Response => {
      emit({ outcome: "ok", status: response.status, model, cached });
      return response;
    },
    modelFailed: (model: string): void => {
      emit({ outcome: "model_failed", status: 502, model });
    },
    screened: (response: Response): Response => {
      emit({ outcome: "screened", status: response.status });
      return response;
    },
    cutOff: (model: string): void => {
      emit({ outcome: "cut_off", status: 200, model });
    },
  };
}

export type Log = ReturnType<typeof reporter>;

/** Runs a route; anything unexpected becomes a logged 500 with no details, never a stack in the response. */
export function route(
  name: AiRoute,
  deps: () => AiDeps,
  run: (request: Request, d: AiDeps, log: Log) => Promise<Response>,
) {
  return async (request: Request): Promise<Response> => {
    const log = reporter(name);
    try {
      return await run(request, deps(), log);
    } catch {
      return log.fail("internal");
    }
  };
}

export type Checked<T> =
  { ok: true; data: T } | { ok: false; code: ErrorCode; headers?: Record<string, string> };

/** Guard, parse and validate a JSON body; the schema is built per request because it checks dates against the server's today. */
export async function readJson<T>(
  request: Request,
  options: Omit<GuardOptions, "type">,
  schema: z.ZodType<T>,
): Promise<Checked<T>> {
  const guarded = await guard(request, { ...options, type: "application/json" });
  if (!guarded.ok) return guarded;
  const body = parseJson(guarded.bytes);
  if (body === undefined) return { ok: false, code: "bad_request" };
  const parsed = schema.safeParse(body);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, code: "invalid" };
}

/** The model chain and today's allowance for this client, or the reason there is none. */
export async function admit(
  request: Request,
  d: AiDeps,
  log: Log,
): Promise<{ ctx: RunContext } | { refused: ErrorCode }> {
  if (!d.chain) return { refused: "ai_unavailable" };
  if (!(await d.daily.take(clientKey(request)))) return { refused: "daily_cap" };
  return {
    ctx: {
      chain: d.chain,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(d.deadlineMs)]),
      onFail: log.modelFailed,
      onCutOff: log.cutOff,
    },
  };
}

export const JSON_HEADERS = { "Cache-Control": "no-store" };

/** A finished answer as JSON, logged with the model that wrote it. */
export function answered(log: Log, result: { model: string } | null): Response {
  if (!result) return log.fail("ai_failed");
  const { model, ...rest } = result;
  return log.ok(Response.json(rest, { headers: JSON_HEADERS }), model);
}
