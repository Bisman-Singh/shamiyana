import "server-only";
import { z } from "zod";

/**
 * Server configuration, validated once at boot by `instrumentation.ts` so a
 * malformed value fails the deploy instead of the first request. A missing
 * API key is allowed: the planner works without AI and says so. Without the
 * Redis pair, limits stay in each instance's memory.
 */

const MODEL_ID = /^[a-z0-9][a-z0-9.-]{1,63}$/;

/** An optional secret or address where an empty value means unset. */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const fields = z.object({
  GOOGLE_GENERATIVE_AI_API_KEY: optionalText,
  GEMINI_MODELS: z
    .string()
    .default("gemini-3.5-flash-lite,gemini-3.5-flash,gemini-3.6-flash,gemini-3.8-flash")
    .transform((list) =>
      list
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().regex(MODEL_ID)).min(1).max(4)),
  AI_DAILY_REQUEST_CAP: z.coerce.number().int().min(1).max(1_000_000).default(2000),
  AI_DAILY_CLIENT_CAP: z.coerce.number().int().min(1).max(100_000).default(100),
  /** Upstash Redis over REST, as the Vercel marketplace integration names it. */
  KV_REST_API_URL: optionalText.pipe(z.url({ protocol: /^https$/ }).optional()),
  KV_REST_API_TOKEN: optionalText,
  /** Its own key for the client codes kept in Redis; without it one is derived from the Gemini key. */
  RATE_LIMIT_SECRET: optionalText.pipe(z.string().min(32).optional()),
  /** "1" off Vercel when a proxy in front overwrites the forwarding headers; read per request by `clientKey`. */
  TRUST_PROXY: optionalText.pipe(z.enum(["0", "1"]).optional()),
});

const schema = fields.transform(
  ({ KV_REST_API_URL: url, KV_REST_API_TOKEN: token, ...rest }, ctx) => {
    if ((url === undefined) !== (token === undefined)) {
      ctx.addIssue({
        code: "custom",
        path: [url === undefined ? "KV_REST_API_URL" : "KV_REST_API_TOKEN"],
        message: "set both or neither",
      });
      return z.NEVER;
    }
    return { ...rest, redis: url && token ? { url, token } : null };
  },
);

/** The checked environment, with the Redis pair folded into one optional object. */
export type ServerEnv = z.output<typeof schema>;

/** A configuration error; its message names the variables, never their values. */
export class EnvError extends Error {
  override name = "EnvError";
}

/** Parses the environment; the error names the bad variables, never their values. */
export function readEnv(source: Record<string, string | undefined> = process.env): ServerEnv {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const keys = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))].join(", ");
    throw new EnvError(`Invalid server environment: ${keys}`);
  }
  return parsed.data;
}
