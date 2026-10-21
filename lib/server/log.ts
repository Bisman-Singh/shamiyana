import "server-only";

/**
 * One JSON line per request outcome. Fields are an allowlist of operational
 * facts: route, outcome, status, timing and model. User text, briefs, images
 * and addresses are never logged.
 */

export interface LogFields {
  route: string;
  outcome: string;
  status: number;
  ms?: number;
  model?: string;
  cached?: boolean;
}

export function logEvent(fields: LogFields): void {
  const line = JSON.stringify({ at: new Date().toISOString(), ...fields });
  if (fields.status >= 500) console.error(line);
  else console.warn(line);
}
