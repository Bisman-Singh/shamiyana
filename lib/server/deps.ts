import "server-only";
import { AnswerCache } from "@/lib/ai/cache";
import { buildChain, type ModelSpec } from "@/lib/ai/models";
import { readEnv, type ServerEnv } from "./env";
import type { AiRoute } from "./log";
import {
  DailyCap,
  RATE_WINDOW_MS,
  RateLimiter,
  type DailyAllowance,
  type RequestLimiter,
} from "./rate-limit";
import {
  connectRedis,
  pseudonymKey,
  SharedDailyCap,
  SharedRateLimiter,
  sharedWindow,
} from "./shared-limits";

/**
 * What the AI routes depend on, passed in rather than imported, so tests
 * drive them with a mock model and a fake clock while the route files wire
 * the real ones.
 */

/** A null chain means no API key, and the AI routes then answer ai_unavailable. */
export interface AiDeps {
  chain: readonly ModelSpec[] | null;
  cache: AnswerCache;
  limiters: Record<AiRoute, RequestLimiter>;
  daily: DailyAllowance;
  now: () => Date;
  /** Time every model attempt of one request shares, so the reply beats the route's own limit. */
  deadlineMs: number;
}

/** Routes may run for 60 s on Vercel; the models get 55 s of it between them, so a slow chain ends in a proper error. */
const DEADLINE_MS = 55_000;

/** Requests per client per minute on each AI route. */
const PER_MINUTE: Record<AiRoute, number> = { plan: 8, refine: 20, vision: 6 };

/**
 * Each route's limit and the daily caps: in Redis when it and the AI key are
 * set, with memory as the fallback. Without a key the AI routes refuse anyway.
 */
function limitsFor(env: ServerEnv): Pick<AiDeps, "limiters" | "daily"> {
  const memory = (route: AiRoute) =>
    new RateLimiter({ limit: PER_MINUTE[route], windowMs: RATE_WINDOW_MS });
  const daily = new DailyCap({ cap: env.AI_DAILY_REQUEST_CAP, clientCap: env.AI_DAILY_CLIENT_CAP });
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!env.redis || apiKey === undefined) {
    return {
      limiters: { plan: memory("plan"), refine: memory("refine"), vision: memory("vision") },
      daily,
    };
  }
  const redis = connectRedis(env.redis);
  const secret = pseudonymKey(apiKey);
  const shared = (route: AiRoute) =>
    new SharedRateLimiter({
      window: sharedWindow(redis, route, PER_MINUTE[route]),
      fallback: memory(route),
      secret,
    });
  return {
    limiters: { plan: shared("plan"), refine: shared("refine"), vision: shared("vision") },
    daily: new SharedDailyCap({
      redis,
      caps: { total: env.AI_DAILY_REQUEST_CAP, client: env.AI_DAILY_CLIENT_CAP },
      fallback: daily,
      secret,
    }),
  };
}

function createDeps(env = readEnv()): AiDeps {
  return {
    chain: buildChain(env),
    cache: new AnswerCache(),
    ...limitsFor(env),
    now: () => new Date(),
    deadlineMs: DEADLINE_MS,
  };
}

let live: AiDeps | null = null;

/** The process-wide dependencies, built on first use. */
export function liveDeps(): AiDeps {
  live ??= createDeps();
  return live;
}
