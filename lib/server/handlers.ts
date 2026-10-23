import "server-only";
import { createTextStreamResponse } from "ai";
import type { z } from "zod";
import { AnswerCache } from "@/lib/ai/cache";
import { isInjectionAttempt, SCREENED_REPLY } from "@/lib/ai/guard";
import { buildChain, type ModelSpec } from "@/lib/ai/models";
import { lookupPlan, streamPlan, textStream } from "@/lib/ai/plan-stream";
import { runRefine } from "@/lib/ai/refine";
import type { RunContext } from "@/lib/ai/run";
import { runVision } from "@/lib/ai/vision";
import { readEnv, type ServerEnv } from "./env";
import {
  clientKey,
  errorResponse,
  guard,
  parseJson,
  type ErrorCode,
  type GuardOptions,
} from "./http";
import { logEvent, type AiRoute, type LogFields } from "./log";
import {
  DailyCap,
  RATE_WINDOW_MS,
  RateLimiter,
  type DailyAllowance,
  type RequestLimiter,
} from "./rate-limit";
import {
  connectRedis,
  pseudonymKey,
  SharedDailyCap,
  SharedRateLimiter,
  sharedWindow,
} from "./shared-limits";
import {
  IMAGE_MAX_BYTES,
  planRequestSchema,
  refineRequestSchema,
  sniffImage,
  visionFieldsSchema,
} from "./requests";

/**
 * Route logic with its dependencies passed in, so tests drive it with a mock
 * model and a fake clock while the route files wire the real ones.
 */

export interface AiDeps {
  chain: readonly ModelSpec[] | null;
  cache: AnswerCache;
  limiters: Record<AiRoute, RequestLimiter>;
  daily: DailyAllowance;
  now: () => Date;
  /** Time every model attempt of one request shares, so the reply beats the route's own limit. */
  deadlineMs: number;
}

/** Routes may run for 60 s on Vercel; the models get 55 s of it between them, so a slow chain ends in a proper error. */
const DEADLINE_MS = 55_000;

/** Request body caps. The photo route's text part is capped on its own. */
const BODY_LIMITS = {
  plan: 8_192,
  refine: 16_384,
  visionFields: 16_384,
} as const;

/** Requests per client per minute on each AI route. */
const PER_MINUTE: Record<AiRoute, number> = { plan: 8, refine: 20, vision: 6 };

/**
 * Each route's limit and the daily caps: in Redis when it and the AI key are
 * set, with memory as the fallback. Without a key the AI routes refuse anyway.
 */
function limitsFor(env: ServerEnv): Pick<AiDeps, "limiters" | "daily"> {
  const memory = (route: AiRoute) =>
    new RateLimiter({ limit: PER_MINUTE[route], windowMs: RATE_WINDOW_MS });
  const daily = new DailyCap({ cap: env.AI_DAILY_REQUEST_CAP, clientCap: env.AI_DAILY_CLIENT_CAP });
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!env.redis || apiKey === undefined) {
    return {
      limiters: { plan: memory("plan"), refine: memory("refine"), vision: memory("vision") },
      daily,
    };
  }
  const redis = connectRedis(env.redis);
  const secret = pseudonymKey(apiKey);
  const shared = (route: AiRoute) =>
    new SharedRateLimiter({
      window: sharedWindow(redis, route, PER_MINUTE[route]),
      fallback: memory(route),
      secret,
    });
  return {
    limiters: { plan: shared("plan"), refine: shared("refine"), vision: shared("vision") },
    daily: new SharedDailyCap({
      redis,
      caps: { total: env.AI_DAILY_REQUEST_CAP, client: env.AI_DAILY_CLIENT_CAP },
      fallback: daily,
      secret,
    }),
  };
}

function createDeps(env = readEnv()): AiDeps {
  return {
    chain: buildChain(env),
    cache: new AnswerCache(),
    ...limitsFor(env),
    now: () => new Date(),
    deadlineMs: DEADLINE_MS,
  };
}

let live: AiDeps | null = null;

/** The process-wide dependencies, built on first use. */
export function liveDeps(): AiDeps {
  live ??= createDeps();
  return live;
}

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

type Log = ReturnType<typeof reporter>;

/** Runs a route; anything unexpected becomes a logged 500 with no details, never a stack in the response. */
function route(
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

type Checked<T> =
  { ok: true; data: T } | { ok: false; code: ErrorCode; headers?: Record<string, string> };

/** Guard, parse and validate a JSON body; the schema is built per request because it checks dates against the server's today. */
async function readJson<T>(
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
async function admit(
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

const STREAM_HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const JSON_HEADERS = { "Cache-Control": "no-store" };

/** A finished answer as JSON, logged with the model that wrote it. */
function answered(log: Log, result: { model: string } | null): Response {
  if (!result) return log.fail("ai_failed");
  const { model, ...rest } = result;
  return log.ok(Response.json(rest, { headers: JSON_HEADERS }), model);
}

/** POST /api/plan: checks the request, then streams ideas or serves them from the cache. */
export function planHandler(deps: () => AiDeps) {
  return route("plan", deps, async (request, d, log) => {
    const input = await readJson(
      request,
      { limiter: d.limiters.plan, maxBytes: BODY_LIMITS.plan },
      planRequestSchema(d.now()),
    );
    if (!input.ok) return log.fail(input.code, input.headers);
    const { key, hit } = await lookupPlan(d.cache, input.data);
    if (hit !== null) {
      return log.ok(
        createTextStreamResponse({ stream: textStream(hit), headers: STREAM_HEADERS }),
        "cache",
        true,
      );
    }
    const gate = await admit(request, d, log);
    if ("refused" in gate) return log.fail(gate.refused);
    const result = await streamPlan(gate.ctx, d.cache, key, input.data);
    if (!result) return log.fail("ai_failed");
    return log.ok(
      createTextStreamResponse({ stream: result.stream, headers: STREAM_HEADERS }),
      result.model,
    );
  });
}

/** POST /api/refine: checks the request, screens the message, then returns a reply and proposed changes. */
export function refineHandler(deps: () => AiDeps) {
  return route("refine", deps, async (request, d, log) => {
    const input = await readJson(
      request,
      { limiter: d.limiters.refine, maxBytes: BODY_LIMITS.refine },
      refineRequestSchema(d.now()),
    );
    if (!input.ok) return log.fail(input.code, input.headers);
    if (isInjectionAttempt(input.data.message)) {
      const reply = SCREENED_REPLY[input.data.locale];
      return log.screened(Response.json({ reply, changes: [] }, { headers: JSON_HEADERS }));
    }
    const gate = await admit(request, d, log);
    if ("refused" in gate) return log.fail(gate.refused);
    return answered(log, await runRefine(gate.ctx, input.data));
  });
}

async function readForm(bytes: Uint8Array, contentType: string): Promise<FormData | null> {
  try {
    return await new Response(bytes as BodyInit, {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    return null;
  }
}

type Upload = Checked<{ image: Uint8Array; mediaType: string; fields: unknown }>;

/** The guarded multipart body: one image whose bytes are a real JPEG, PNG or WebP, plus a small JSON part. */
async function readUpload(request: Request, d: AiDeps): Promise<Upload> {
  const guarded = await guard(request, {
    limiter: d.limiters.vision,
    maxBytes: IMAGE_MAX_BYTES + BODY_LIMITS.visionFields,
    type: "multipart/form-data",
  });
  if (!guarded.ok) return guarded;
  const form = await readForm(guarded.bytes, guarded.contentType);
  const image = form?.get("image");
  const fields = form?.get("fields");
  if (!(image instanceof File) || typeof fields !== "string")
    return { ok: false, code: "bad_request" };
  if (image.size > IMAGE_MAX_BYTES || fields.length > BODY_LIMITS.visionFields)
    return { ok: false, code: "too_large" };
  const parsedFields = parseJson(new TextEncoder().encode(fields));
  if (parsedFields === undefined) return { ok: false, code: "bad_request" };
  const bytes = new Uint8Array(await image.arrayBuffer());
  const mediaType = sniffImage(bytes);
  if (!mediaType) return { ok: false, code: "unsupported_media_type" };
  return { ok: true, data: { image: bytes, mediaType, fields: parsedFields } };
}

/** POST /api/vision: checks the upload's real type and size, then returns ideas from the photo. */
export function visionHandler(deps: () => AiDeps) {
  return route("vision", deps, async (request, d, log) => {
    const upload = await readUpload(request, d);
    if (!upload.ok) return log.fail(upload.code, upload.headers);
    const parsed = visionFieldsSchema(d.now()).safeParse(upload.data.fields);
    if (!parsed.success) return log.fail("invalid");
    const gate = await admit(request, d, log);
    if ("refused" in gate) return log.fail(gate.refused);
    const { image, mediaType } = upload.data;
    return answered(log, await runVision(gate.ctx, { ...parsed.data, image, mediaType }));
  });
}

/** Up or not, and nothing else: whether AI is configured stays private. */
export function healthHandler(): Response {
  return Response.json({ status: "ok" }, { headers: JSON_HEADERS });
}
