import "server-only";
import { createTextStreamResponse } from "ai";
import { lookupPlan, streamPlan, textStream } from "@/lib/ai/plan-stream";
import { planRequestSchema } from "@/lib/api/contracts";
import type { AiDeps } from "./deps";
import {
  admit,
  aiRoute,
  BODY_LIMITS,
  readJson,
  type RouteHandler,
  type RouteLog,
} from "./route-kit";

/** Set here as well as in next.config.ts, so a handler's answer is right on its own. */
const STREAM_HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function streamed(stream: ReadableStream<string>): Response {
  return createTextStreamResponse({ stream, headers: STREAM_HEADERS });
}

/** The cache is read before the allowance is taken, so a repeat brief costs nothing. */
async function handlePlan(request: Request, deps: AiDeps, log: RouteLog): Promise<Response> {
  const input = await readJson(
    request,
    { limiter: deps.limiters.plan, maxBytes: BODY_LIMITS.plan },
    planRequestSchema(deps.now()),
  );
  if (!input.ok) return log.fail(input.code, input.headers);
  const { key, hit } = await lookupPlan(deps.cache, input.data);
  if (hit !== null) return log.ok(streamed(textStream(hit)), "cache", true);
  const gate = await admit(request, deps, log);
  if ("refused" in gate) return log.fail(gate.refused);
  const result = await streamPlan(gate.ctx, deps.cache, key, input.data);
  if (!result) return log.fail("ai_failed");
  return log.ok(streamed(result.stream), result.model);
}

/** POST /api/plan: checks the request, then streams ideas or serves them from the cache. */
export function planHandler(getDeps: () => AiDeps): RouteHandler {
  return aiRoute("plan", getDeps, handlePlan);
}
