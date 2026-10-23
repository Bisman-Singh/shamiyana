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

/** One log line per outcome of a request, each with the route and the time since it started. */
export interface RouteLog {
  fail: (code: ErrorCode, headers?: Record<string, string>) => Response;
  /** A bare 500 for anything unexpected, logged by the error's class name only. */
  crash: (error: unknown) => Response;
  ok: (response: Response, model: string, cached?: boolean) => Response;
  modelFailed: (model: string) => void;
  screened: (response: Response) => Response;
  cutOff: (model: string) => void;
}

function startRouteLog(route: AiRoute): RouteLog {
  const started = Date.now();
  const emit = (fields: Omit<LogFields, "route" | "ms">) => {
    logEvent({ route, ms: Date.now() - started, ...fields });
  };
  return {
    fail: (code, headers) => {
      const response = errorResponse(code, headers);
      emit({ outcome: code, status: response.status });
      return response;
    },
    crash: (error) => {
      const response = errorResponse("internal");
      const errorType = error instanceof Error ? error.name : typeof error;
      emit({ outcome: "internal", status: response.status, errorType });
      return response;
    },
    ok: (response, model, cached = false) => {
      emit({ outcome: "ok", status: response.status, model, cached });
      return response;
    },
    modelFailed: (model) => {
      emit({ outcome: "model_failed", status: 502, model });
    },
    screened: (response) => {
      emit({ outcome: "screened", status: response.status });
      return response;
    },
    cutOff: (model) => {
      emit({ outcome: "cut_off", status: 200, model });
    },
  };
}

/** A request handler as a route file exports it. */
export type RouteHandler = (request: Request) => Promise<Response>;

/** One route's own steps, given the request, its dependencies and its log. */
export type RouteSteps = (request: Request, deps: AiDeps, log: RouteLog) => Promise<Response>;

/**
 * Runs a route's steps with a fresh log and the dependencies looked up per
 * request. Anything unexpected becomes a logged 500 with no details, never a
 * stack in the response.
 */
export function aiRoute(name: AiRoute, getDeps: () => AiDeps, steps: RouteSteps): RouteHandler {
  return async (request) => {
    const log = startRouteLog(name);
    try {
      return await steps(request, getDeps(), log);
    } catch (error) {
      return log.crash(error);
    }
  };
}

/** A read body, or the error code and headers to answer with instead. */
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
  deps: AiDeps,
  log: RouteLog,
): Promise<Checked<RunContext>> {
  if (!deps.chain) return { ok: false, code: "ai_unavailable" };
  if (!(await deps.daily.take(clientKey(request)))) return { ok: false, code: "daily_cap" };
  return {
    ok: true,
    data: {
      chain: deps.chain,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(deps.deadlineMs)]),
      onFail: log.modelFailed,
      onCutOff: log.cutOff,
    },
  };
}

/** Set here as well as for all of /api in next.config.ts, so a handler's answer is right on its own. */
export const JSON_HEADERS = { "Cache-Control": "no-store" };

/** A finished answer as JSON, logged with the model that wrote it. */
export function answered(log: RouteLog, result: { model: string } | null): Response {
  if (!result) return log.fail("ai_failed");
  const { model, ...rest } = result;
  return log.ok(Response.json(rest, { headers: JSON_HEADERS }), model);
}
