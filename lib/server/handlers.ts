import "server-only";
import { createTextStreamResponse } from "ai";
import type { z } from "zod";
import { AnswerCache } from "@/lib/ai/cache";
import { buildChain, type ModelSpec } from "@/lib/ai/models";
import {
  lookupPlan,
  runRefine,
  runVision,
  streamPlan,
  textStream,
  type RunContext,
} from "@/lib/ai/run";
import { readEnv } from "./env";
import {
  clientKey,
  errorResponse,
  guard,
  parseJson,
  type ErrorCode,
  type GuardOptions,
} from "./http";
import { logEvent, type LogRoute } from "./log";
import { DailyCap, RateLimiter } from "./rate-limit";
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
  limiters: { plan: RateLimiter; refine: RateLimiter; vision: RateLimiter };
  daily: DailyCap;
  now: () => Date;
}

/** Request body caps. The photo route's text part is capped on its own. */
const BODY_LIMITS = {
  plan: 8_192,
  refine: 16_384,
  visionFields: 16_384,
} as const;

function createDeps(env = readEnv()): AiDeps {
  return {
    chain: buildChain(env),
    cache: new AnswerCache(),
    limiters: {
      plan: new RateLimiter({ limit: 8, windowMs: 60_000 }),
      refine: new RateLimiter({ limit: 20, windowMs: 60_000 }),
      vision: new RateLimiter({ limit: 6, windowMs: 60_000 }),
    },
    daily: new DailyCap(env.AI_DAILY_REQUEST_CAP, env.AI_DAILY_CLIENT_CAP),
    now: () => new Date(),
  };
}

let live: AiDeps | null = null;

/** The process-wide dependencies, built on first use. */
export function liveDeps(): AiDeps {
  live ??= createDeps();
  return live;
}

function reporter(route: LogRoute) {
  const started = Date.now();
  return {
    fail: (code: ErrorCode, headers?: Record<string, string>): Response => {
      const response = errorResponse(code, headers);
      logEvent({ route, outcome: code, status: response.status, ms: Date.now() - started });
      return response;
    },
    ok: (response: Response, model: string, cached = false): Response => {
      logEvent({
        route,
        outcome: "ok",
        status: response.status,
        ms: Date.now() - started,
        model,
        cached,
      });
      return response;
    },
    modelFailed: (model: string): void => {
      logEvent({ route, outcome: "model_failed", status: 502, ms: Date.now() - started, model });
    },
    cutOff: (model: string): void => {
      logEvent({ route, outcome: "cut_off", status: 200, ms: Date.now() - started, model });
    },
  };
}

type Log = ReturnType<typeof reporter>;

/** Runs a route; anything unexpected becomes a logged 500 with no details, never a stack in the response. */
function route(
  name: LogRoute,
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

/** Guard, parse and validate a JSON body against a schema built for this moment. */
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
function admit(
  request: Request,
  d: AiDeps,
  log: Log,
): { ctx: RunContext } | { refused: ErrorCode } {
  if (!d.chain) return { refused: "ai_unavailable" };
  if (!d.daily.take(clientKey(request))) return { refused: "daily_cap" };
  return {
    ctx: {
      chain: d.chain,
      signal: request.signal,
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

export function planHandler(deps: () => AiDeps) {
  return route("plan", deps, async (request, d, log) => {
    const input = await readJson(
      request,
      { limiter: d.limiters.plan, maxBytes: BODY_LIMITS.plan },
      planRequestSchema(d.now()),
    );
    if (!input.ok) return log.fail(input.code, input.headers);
    if (!d.chain) return log.fail("ai_unavailable");
    const { key, hit } = await lookupPlan(d.cache, input.data);
    if (hit !== null) {
      return log.ok(
        createTextStreamResponse({ stream: textStream(hit), headers: STREAM_HEADERS }),
        "cache",
        true,
      );
    }
    const gate = admit(request, d, log);
    if ("refused" in gate) return log.fail(gate.refused);
    const result = await streamPlan(gate.ctx, d.cache, key, input.data);
    if (!result) return log.fail("ai_failed");
    return log.ok(
      createTextStreamResponse({ stream: result.stream, headers: STREAM_HEADERS }),
      result.model,
    );
  });
}

export function refineHandler(deps: () => AiDeps) {
  return route("refine", deps, async (request, d, log) => {
    const input = await readJson(
      request,
      { limiter: d.limiters.refine, maxBytes: BODY_LIMITS.refine },
      refineRequestSchema(d.now()),
    );
    if (!input.ok) return log.fail(input.code, input.headers);
    const gate = admit(request, d, log);
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

export function visionHandler(deps: () => AiDeps) {
  return route("vision", deps, async (request, d, log) => {
    const upload = await readUpload(request, d);
    if (!upload.ok) return log.fail(upload.code, upload.headers);
    const parsed = visionFieldsSchema(d.now()).safeParse(upload.data.fields);
    if (!parsed.success) return log.fail("invalid");
    const gate = admit(request, d, log);
    if ("refused" in gate) return log.fail(gate.refused);
    const { image, mediaType } = upload.data;
    return answered(log, await runVision(gate.ctx, { ...parsed.data, image, mediaType }));
  });
}

/** Up or not, and nothing else: whether AI is configured stays private. */
export function healthHandler(): Response {
  return Response.json({ status: "ok" }, { headers: JSON_HEADERS });
}
