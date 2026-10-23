import "server-only";
import { isInjectionAttempt, SCREENED_REPLY } from "@/lib/ai/guard";
import { runRefine } from "@/lib/ai/refine";
import { refineRequestSchema } from "@/lib/api/contracts";
import type { AiDeps } from "./deps";
import {
  admit,
  aiRoute,
  answered,
  BODY_LIMITS,
  JSON_HEADERS,
  readJson,
  type RouteHandler,
  type RouteLog,
} from "./route-kit";

/** The message is screened before the allowance is taken, so an attempt to re-instruct the assistant costs nothing. */
async function handleRefine(request: Request, deps: AiDeps, log: RouteLog): Promise<Response> {
  const input = await readJson(
    request,
    { limiter: deps.limiters.refine, maxBytes: BODY_LIMITS.refine },
    refineRequestSchema(deps.now()),
  );
  if (!input.ok) return log.fail(input.code, input.headers);
  if (isInjectionAttempt(input.data.message)) {
    const reply = SCREENED_REPLY[input.data.locale];
    return log.screened(Response.json({ reply, changes: [] }, { headers: JSON_HEADERS }));
  }
  const gate = await admit(request, deps, log);
  if (!gate.ok) return log.fail(gate.code);
  return answered(log, await runRefine(gate.data, input.data));
}

/** POST /api/refine: checks the request, screens the message, then returns a reply and proposed changes. */
export function refineHandler(getDeps: () => AiDeps): RouteHandler {
  return aiRoute("refine", getDeps, handleRefine);
}
