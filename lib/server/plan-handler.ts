import "server-only";
import { createTextStreamResponse } from "ai";
import { lookupPlan, streamPlan, textStream } from "@/lib/ai/plan-stream";
import type { AiDeps } from "./deps";
import { planRequestSchema } from "./requests";
import { admit, BODY_LIMITS, readJson, route } from "./route-kit";

const STREAM_HEADERS = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

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
