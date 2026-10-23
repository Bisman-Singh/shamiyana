import "server-only";
import type { ErrorCode } from "./http";

/**
 * One JSON line per request outcome. Fields are an allowlist of operational
 * facts: route, outcome, status, timing and model. User text, briefs, images
 * and addresses are never logged.
 */

export type LogRoute = "plan" | "refine" | "vision";

/**
 * `cut_off`: a streamed answer stopped partway while the client was still there.
 * `screened`: the message tried to re-instruct the assistant and got the fixed reply.
 */
export type LogOutcome = "ok" | "model_failed" | "cut_off" | "screened" | ErrorCode;

export interface LogFields {
  route: LogRoute;
  outcome: LogOutcome;
  status: number;
  ms?: number;
  model?: string;
  cached?: boolean;
}

function line(fields: object): string {
  return JSON.stringify({ at: new Date().toISOString(), ...fields });
}

/** Failures and cut-off answers at error level, everything else as information. */
export function logEvent(fields: LogFields): void {
  if (fields.status >= 500 || fields.outcome === "cut_off") console.error(line(fields));
  else console.info(line(fields));
}

export interface Notice {
  event: "ai_off";
  reason: "no_api_key";
}

/** A configuration warning at startup, such as the AI being off for want of a key. */
export function logNotice(notice: Notice): void {
  console.warn(line(notice));
}
