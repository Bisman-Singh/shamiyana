import "server-only";
import { BoundedMap } from "./bounded-map";

/**
 * Sliding-window rate limiting held in memory, one window per client key.
 *
 * Memory is bounded: past `maxKeys` the least recently seen key is dropped,
 * so a flood of spoofed addresses cannot grow the map without limit. These
 * limits are per server instance; `shared-limits.ts` holds the same limits in
 * Redis for every instance and falls back to these.
 */

export interface RateResult {
  ok: boolean;
  /** Seconds until the next request would be allowed; 0 when allowed. */
  retryAfter: number;
}

/** A per-client request limit, held in memory or shared. */
export interface RequestLimiter {
  check(key: string): RateResult | Promise<RateResult>;
}

/** A daily allowance of AI calls, held in memory or shared. */
export interface DailyAllowance {
  take(client?: string): boolean | Promise<boolean>;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}

/** A sliding window per client key, held in this instance's memory. */
export class RateLimiter implements RequestLimiter {
  private readonly hits: BoundedMap<string, number[]>;
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(options: RateLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.hits = new BoundedMap(options.maxKeys ?? 5_000);
    this.now = options.now ?? Date.now;
  }

  check(key: string): RateResult {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      const oldest = recent[0] ?? now;
      return {
        ok: false,
        retryAfter: Math.max(1, Math.ceil((oldest + this.windowMs - now) / 1000)),
      };
    }
    recent.push(now);
    this.hits.set(key, recent);
    return { ok: true, retryAfter: 0 };
  }

  get size(): number {
    return this.hits.size;
  }
}

/**
 * Hard ceilings on AI calls per UTC day: one for this instance, a spend cap
 * that needs no billing API, and a smaller one per client so a single
 * client can't use up everyone's day. Client memory is bounded like the
 * rate limiter's.
 */
export class DailyCap implements DailyAllowance {
  private day = "";
  private count = 0;
  private readonly byClient: BoundedMap<string, number>;

  constructor(
    private readonly cap: number,
    private readonly clientCap: number = cap,
    private readonly now: () => number = Date.now,
    maxKeys = 10_000,
  ) {
    this.byClient = new BoundedMap(maxKeys);
  }

  take(client = ""): boolean {
    const today = new Date(this.now()).toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.count = 0;
      this.byClient.clear();
    }
    const used = this.byClient.get(client) ?? 0;
    if (this.count >= this.cap || used >= this.clientCap) return false;
    this.count += 1;
    this.byClient.set(client, used + 1);
    return true;
  }
}
