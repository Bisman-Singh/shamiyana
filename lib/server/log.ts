import "server-only";
import type { ErrorCode } from "./http";

/**
 * One JSON line per request outcome. Fields are an allowlist of operational
 * facts: route, outcome, status, timing and model. User text, briefs, images
 * and addresses are never logged.
 */

/** The AI routes, by the names their limits and log lines use. */
export type AiRoute = "plan" | "refine" | "vision";

/**
 * `cut_off`: a streamed answer stopped partway while the client was still there.
 * `screened`: the message tried to re-instruct the assistant and got the fixed reply.
 */
export type LogOutcome = "ok" | "model_failed" | "cut_off" | "screened" | ErrorCode;

/** A log line's fields. User text has no field here, so it has nowhere to go. */
export interface LogFields {
  route: AiRoute;
  outcome: LogOutcome;
  status: number;
  ms?: number;
  model?: string;
  cached?: boolean;
  /** An unexpected error's class name. Never its message, which can carry user text. */
  errorType?: string;
}

function line(fields: object): string {
  return JSON.stringify({ at: new Date().toISOString(), ...fields });
}

/** Failures and cut-off answers at error level, everything else as information. */
export function logEvent(fields: LogFields): void {
  if (fields.status >= 500 || fields.outcome === "cut_off") {
    console.error(line(fields));
  } else {
    console.info(line(fields));
  }
}

/** Fixed notices only, so a warning never carries a value from the environment. */
export type ConfigNotice =
  | { event: "ai_off"; reason: "no_api_key" }
  | { event: "limits_local"; reason: "redis_unavailable" };

/**
 * A configuration warning, such as the AI being off for want of a key, or a
 * request limited in memory because Redis did not answer.
 */
export function logNotice(notice: ConfigNotice): void {
  console.warn(line(notice));
}
