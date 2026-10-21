import "server-only";

/**
 * Sliding-window rate limiting held in memory, one window per client key.
 *
 * Memory is bounded: past `maxKeys` the least recently seen key is dropped,
 * so a flood of spoofed addresses cannot grow the map without limit. Limits
 * are per server instance, which is what an app without a shared store can
 * honestly promise.
 */

export interface RateResult {
  ok: boolean;
  /** Seconds until the next request would be allowed; 0 when allowed. */
  retryAfter: number;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  maxKeys?: number;
  now?: () => number;
}

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;
  private readonly now: () => number;

  constructor(options: RateLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.maxKeys = options.maxKeys ?? 5_000;
    this.now = options.now ?? Date.now;
  }

  check(key: string): RateResult {
    const now = this.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    this.hits.delete(key);
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
    for (const stale of this.hits.keys()) {
      if (this.hits.size <= this.maxKeys) break;
      this.hits.delete(stale);
    }
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
export class DailyCap {
  private day = "";
  private count = 0;
  private readonly byClient = new Map<string, number>();

  constructor(
    private readonly cap: number,
    private readonly clientCap: number = cap,
    private readonly now: () => number = Date.now,
    private readonly maxKeys = 10_000,
  ) {}

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
    this.byClient.delete(client);
    this.byClient.set(client, used + 1);
    for (const stale of this.byClient.keys()) {
      if (this.byClient.size <= this.maxKeys) break;
      this.byClient.delete(stale);
    }
    return true;
  }
}
