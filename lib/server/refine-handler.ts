import "server-only";
import { isInjectionAttempt, SCREENED_REPLY } from "@/lib/ai/guard";
import { runRefine } from "@/lib/ai/refine";
import type { AiDeps } from "./deps";
import { refineRequestSchema } from "./requests";
import { admit, answered, BODY_LIMITS, JSON_HEADERS, readJson, route } from "./route-kit";

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
