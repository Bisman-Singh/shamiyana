import "server-only";
import { z } from "zod";

/**
 * Server configuration, validated once at boot by `instrumentation.ts` so a
 * malformed value fails the deploy instead of the first request. A missing
 * API key is allowed: the planner works without AI and says so.
 */

const MODEL_ID = /^[a-z0-9][a-z0-9.-]{1,63}$/;

const schema = z.object({
  GOOGLE_GENERATIVE_AI_API_KEY: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  GEMINI_MODELS: z
    .string()
    .default("gemini-3.5-flash-lite,gemini-3.5-flash,gemini-3.6-flash,gemini-3.8-flash")
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().regex(MODEL_ID)).min(1).max(4)),
  AI_DAILY_REQUEST_CAP: z.coerce.number().int().min(1).max(1_000_000).default(2000),
  AI_DAILY_CLIENT_CAP: z.coerce.number().int().min(1).max(100_000).default(100),
});

export type ServerEnv = z.infer<typeof schema>;

export class EnvError extends Error {
  override name = "EnvError";
}

/** Parses the environment; the error names the bad variables, never their values. */
export function readEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const keys = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))].join(", ");
    throw new EnvError(`Invalid server environment: ${keys}`);
  }
  return parsed.data;
}
