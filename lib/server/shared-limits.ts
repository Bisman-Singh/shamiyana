import "server-only";
import { createHmac } from "node:crypto";
import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { utcDay } from "@/lib/plan/dates";
import { logNotice } from "./log";
import {
  RATE_WINDOW_MS,
  secondsUntil,
  type DailyAllowance,
  type DailyCap,
  type RateLimiter,
  type RateResult,
  type RequestLimiter,
} from "./rate-limit";

/**
 * The same limits as `rate-limit.ts`, kept in Upstash Redis so every server
 * instance shares them. A serverless deploy runs many instances, and limits
 * held in memory would let a client spend them once per instance.
 *
 * Redis never sees a client address, only a keyed one-way code of it. When
 * Redis fails or is slow, the instance's own memory limits decide, so a
 * request is never let through unlimited.
 */

const PREFIX = "shamiyana";
/** How long a request waits on Redis before the memory limits decide. */
const TIMEOUT_MS = 1_000;
const DAY_SECONDS = 86_400;

/** An Upstash client that gives up after one retry or a second, and sends no telemetry. */
export function connectRedis(config: { url: string; token: string }): Redis {
  return new Redis({
    ...config,
    retry: { retries: 1 },
    signal: () => AbortSignal.timeout(TIMEOUT_MS),
    enableTelemetry: false,
  });
}

/**
 * The key client codes are made with, derived from the server's Gemini key.
 * Upstash never holds it, so the codes in Redis can't be turned back into
 * addresses by trying every one.
 */
export function pseudonymKey(apiKey: string): string {
  return createHmac("sha256", apiKey).update("shamiyana client codes").digest("base64url");
}

/** A stable code for a client key that cannot be turned back into the address without the secret. */
export function pseudonym(secret: string, key: string): string {
  return createHmac("sha256", secret).update(key).digest("base64url").slice(0, 22);
}

/** The one call the shared window needs, so tests can stand in for Upstash. */
export interface WindowClient {
  limit(identifier: string): Promise<{ success: boolean; reset: number; reason?: string }>;
}

export interface SharedRateLimiterOptions {
  window: WindowClient;
  /** This instance's own limit, which decides while Redis is down or slow. */
  fallback: RateLimiter;
  /** The key client codes are made with, from `pseudonymKey`. */
  secret: string;
  now?: () => number;
}

/** The per-minute limit held in Redis for every instance, with this instance's memory as the fallback. */
export class SharedRateLimiter implements RequestLimiter {
  private readonly window: WindowClient;
  private readonly fallback: RateLimiter;
  private readonly secret: string;
  private readonly now: () => number;

  constructor(options: SharedRateLimiterOptions) {
    this.window = options.window;
    this.fallback = options.fallback;
    this.secret = options.secret;
    this.now = options.now ?? Date.now;
  }

  async check(key: string): Promise<RateResult> {
    try {
      const result = await this.window.limit(pseudonym(this.secret, key));
      if (result.reason === "timeout") return this.local(key);
      if (result.success) return { ok: true, retryAfter: 0 };
      return { ok: false, retryAfter: secondsUntil(result.reset, this.now()) };
    } catch {
      return this.local(key);
    }
  }

  private local(key: string): RateResult {
    logNotice({ event: "limits_local", reason: "redis_unavailable" });
    return this.fallback.check(key);
  }
}

/** The memory limits' window in the form Upstash takes, so both count over the same span. */
export const SHARED_WINDOW: Duration = `${RATE_WINDOW_MS / 1000} s`;

/** A sliding window of `limit` requests a minute per client, shared through Redis. */
export function sharedWindow(redis: Redis, name: string, limit: number): WindowClient {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, SHARED_WINDOW),
    prefix: `${PREFIX}:rate:${name}`,
    ephemeralCache: false,
    analytics: false,
    timeout: TIMEOUT_MS,
  });
}

/**
 * Counts one call against today's instance-wide and per-client caps in one
 * atomic step, and only when both still have room, so refused calls never use
 * up anyone's allowance. Both counters expire at the next UTC midnight.
 */
const TAKE_SCRIPT = `
local total = tonumber(redis.call("GET", KEYS[1]) or "0")
local mine = tonumber(redis.call("GET", KEYS[2]) or "0")
if total >= tonumber(ARGV[1]) or mine >= tonumber(ARGV[2]) then return 0 end
redis.call("INCR", KEYS[1])
redis.call("EXPIREAT", KEYS[1], ARGV[3])
redis.call("INCR", KEYS[2])
redis.call("EXPIREAT", KEYS[2], ARGV[3])
return 1`;

/** The one call the shared daily cap needs, so tests can stand in for Upstash. */
export interface ScriptClient {
  eval(script: string, keys: string[], args: number[]): Promise<unknown>;
}

export interface SharedDailyCapOptions {
  redis: ScriptClient;
  caps: { total: number; client: number };
  /** This instance's own caps, which decide while Redis is down or slow. */
  fallback: DailyCap;
  /** The key client codes are made with, from `pseudonymKey`. */
  secret: string;
  now?: () => number;
}

/** The daily caps held in Redis for every instance, with this instance's memory as the fallback. */
export class SharedDailyCap implements DailyAllowance {
  private readonly redis: ScriptClient;
  private readonly caps: { total: number; client: number };
  private readonly fallback: DailyCap;
  private readonly secret: string;
  private readonly now: () => number;

  constructor(options: SharedDailyCapOptions) {
    this.redis = options.redis;
    this.caps = options.caps;
    this.fallback = options.fallback;
    this.secret = options.secret;
    this.now = options.now ?? Date.now;
  }

  async take(client = ""): Promise<boolean> {
    const day = utcDay(this.now());
    const midnight = Date.parse(day) / 1000 + DAY_SECONDS;
    const total = `${PREFIX}:daily:${day}`;
    try {
      const taken = await this.redis.eval(
        TAKE_SCRIPT,
        [total, `${total}:${pseudonym(this.secret, client)}`],
        [this.caps.total, this.caps.client, midnight],
      );
      return taken === 1;
    } catch {
      logNotice({ event: "limits_local", reason: "redis_unavailable" });
      return this.fallback.take(client);
    }
  }
}
