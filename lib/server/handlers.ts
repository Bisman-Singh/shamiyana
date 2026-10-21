import "server-only";
import { createTextStreamResponse } from "ai";
import { AnswerCache } from "@/lib/ai/cache";
import { buildChain, type ModelSpec } from "@/lib/ai/models";
import { PROMPT_VERSION } from "@/lib/ai/prompts";
import { lookupPlan, runRefine, runVision, streamPlan, textStream } from "@/lib/ai/run";
import { readEnv } from "./env";
import { errorResponse, guard, parseJson, type ErrorCode } from "./http";
import { logEvent } from "./log";
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

export function createDeps(env = readEnv()): AiDeps {
  return {
    chain: buildChain(env),
    cache: new AnswerCache(),
    limiters: {
      plan: new RateLimiter({ limit: 8, windowMs: 60_000 }),
      refine: new RateLimiter({ limit: 20, windowMs: 60_000 }),
      vision: new RateLimiter({ limit: 6, windowMs: 60_000 }),
    },
    daily: new DailyCap(env.AI_DAILY_REQUEST_CAP),
    now: () => new Date(),
  };
}

let live: AiDeps | null = null;

/** The process-wide dependencies, built on first use. */
export function liveDeps(): AiDeps {
  live ??= createDeps();
  return live;
}

type Route = "plan" | "refine" | "vision";

function reporter(route: Route) {
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
  };
}

const STREAM_HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export function planHandler(deps: () => AiDeps) {
  return async (request: Request): Promise<Response> => {
    const log = reporter("plan");
    const d = deps();
    const guarded = await guard(request, {
      limiter: d.limiters.plan,
      maxBytes: 8_192,
      type: "application/json",
    });
    if (!guarded.ok) return log.fail(guarded.code, guarded.headers);
    const body = parseJson(guarded.bytes);
    if (body === undefined) return log.fail("bad_request");
    const parsed = planRequestSchema(d.now()).safeParse(body);
    if (!parsed.success) return log.fail("invalid");
    if (!d.chain) return log.fail("ai_unavailable");

    const { key, hit } = await lookupPlan(d.cache, parsed.data);
    if (hit !== null) {
      return log.ok(
        createTextStreamResponse({ stream: textStream(hit), headers: STREAM_HEADERS }),
        "cache",
        true,
      );
    }
    if (!d.daily.take()) return log.fail("daily_cap");
    const result = await streamPlan(
      { chain: d.chain, signal: request.signal, onFail: log.modelFailed },
      d.cache,
      key,
      parsed.data,
    );
    if (!result) return log.fail("ai_failed");
    return log.ok(
      createTextStreamResponse({ stream: result.stream, headers: STREAM_HEADERS }),
      result.model,
    );
  };
}

export function refineHandler(deps: () => AiDeps) {
  return async (request: Request): Promise<Response> => {
    const log = reporter("refine");
    const d = deps();
    const guarded = await guard(request, {
      limiter: d.limiters.refine,
      maxBytes: 16_384,
      type: "application/json",
    });
    if (!guarded.ok) return log.fail(guarded.code, guarded.headers);
    const body = parseJson(guarded.bytes);
    if (body === undefined) return log.fail("bad_request");
    const parsed = refineRequestSchema(d.now()).safeParse(body);
    if (!parsed.success) return log.fail("invalid");
    if (!d.chain) return log.fail("ai_unavailable");
    if (!d.daily.take()) return log.fail("daily_cap");
    const answer = await runRefine(
      { chain: d.chain, signal: request.signal, onFail: log.modelFailed },
      parsed.data,
    );
    if (!answer) return log.fail("ai_failed");
    const { model, ...rest } = answer;
    return log.ok(Response.json(rest, { headers: { "Cache-Control": "no-store" } }), model);
  };
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

type Upload =
  | { ok: true; image: Uint8Array; mediaType: string; fields: string }
  | { ok: false; code: ErrorCode; headers?: Record<string, string> };

/** The guarded multipart body: one image whose bytes are a real JPEG, PNG or WebP, plus a JSON field. */
async function readUpload(request: Request, d: AiDeps): Promise<Upload> {
  const guarded = await guard(request, {
    limiter: d.limiters.vision,
    maxBytes: IMAGE_MAX_BYTES + 16_384,
    type: "multipart/form-data",
  });
  if (!guarded.ok) return guarded;
  const form = await readForm(guarded.bytes, guarded.contentType);
  const image = form?.get("image");
  const fields = form?.get("fields");
  if (!(image instanceof File) || typeof fields !== "string")
    return { ok: false, code: "bad_request" };
  if (image.size > IMAGE_MAX_BYTES) return { ok: false, code: "too_large" };
  const bytes = new Uint8Array(await image.arrayBuffer());
  const mediaType = sniffImage(bytes);
  if (!mediaType) return { ok: false, code: "unsupported_media_type" };
  return { ok: true, image: bytes, mediaType, fields };
}

export function visionHandler(deps: () => AiDeps) {
  return async (request: Request): Promise<Response> => {
    const log = reporter("vision");
    const d = deps();
    const upload = await readUpload(request, d);
    if (!upload.ok) return log.fail(upload.code, upload.headers);
    const { image: bytes, mediaType, fields } = upload;
    const parsed = visionFieldsSchema(d.now()).safeParse(
      parseJson(new TextEncoder().encode(fields)),
    );
    if (!parsed.success) return log.fail("invalid");
    if (!d.chain) return log.fail("ai_unavailable");
    if (!d.daily.take()) return log.fail("daily_cap");
    const result = await runVision(
      { chain: d.chain, signal: request.signal, onFail: log.modelFailed },
      { ...parsed.data, image: bytes, mediaType },
    );
    if (!result) return log.fail("ai_failed");
    const { model, ...rest } = result;
    return log.ok(Response.json(rest, { headers: { "Cache-Control": "no-store" } }), model);
  };
}

export function healthHandler(deps: () => AiDeps) {
  return (): Response =>
    Response.json(
      { status: "ok", ai: deps().chain ? "configured" : "off", prompts: PROMPT_VERSION },
      { headers: { "Cache-Control": "no-store" } },
    );
}
