import { Ratelimit } from "@upstash/ratelimit";
import { DailyCap, RATE_WINDOW_MS, RateLimiter } from "@/lib/server/rate-limit";
import {
  SharedDailyCap,
  SHARED_WINDOW,
  SharedRateLimiter,
  connectRedis,
  pseudonym,
  pseudonymKey,
  sharedWindow,
  type ScriptClient,
  type WindowClient,
} from "@/lib/server/shared-limits";
import { weddingFacts } from "../helpers/fixtures";
import { jsonPost } from "../helpers/ai";

const NOW = Date.parse("2026-10-23T10:00:00Z");
const SECRET = "test-token";
/** Nothing listens on the discard port, so every call to it fails at once. */
const UNREACHABLE = { url: "https://127.0.0.1:9", token: SECRET };

const warnings: string[] = [];
beforeEach(() => {
  warnings.length = 0;
  vi.spyOn(console, "warn").mockImplementation((line: unknown) => {
    warnings.push(String(line));
  });
});

const memory = () => new RateLimiter({ limit: 1, windowMs: 60_000, now: () => NOW });

/** The take script's rule in plain code: count only when both caps have room. */
class FakeScript implements ScriptClient {
  readonly counts = new Map<string, number>();
  readonly calls: { keys: string[]; args: number[] }[] = [];

  eval(_script: string, keys: string[], args: number[]): Promise<unknown> {
    this.calls.push({ keys, args });
    const [all = "", mine = ""] = keys;
    const [cap = 0, clientCap = 0] = args;
    const total = this.counts.get(all) ?? 0;
    const used = this.counts.get(mine) ?? 0;
    if (total >= cap || used >= clientCap) return Promise.resolve(0);
    this.counts.set(all, total + 1);
    this.counts.set(mine, used + 1);
    return Promise.resolve(1);
  }
}

describe("SHARED_WINDOW", () => {
  it("is the same window as the memory limits", () => {
    expect(SHARED_WINDOW).toBe(`${String(RATE_WINDOW_MS / 1000)} s`);
  });
});

describe("pseudonymKey", () => {
  it("derives a stable key that does not reveal the API key", () => {
    const key = pseudonymKey("api-key-123");
    expect(key).toBe(pseudonymKey("api-key-123"));
    expect(key).not.toContain("api-key-123");
    expect(pseudonymKey("another-key")).not.toBe(key);
  });
});

describe("pseudonym", () => {
  it("is stable, keyed and never contains the address", () => {
    const code = pseudonym(SECRET, "203.0.113.7");
    expect(code).toBe(pseudonym(SECRET, "203.0.113.7"));
    expect(code).toHaveLength(22);
    expect(code).not.toContain("203");
    expect(pseudonym("other", "203.0.113.7")).not.toBe(code);
    expect(pseudonym(SECRET, "203.0.113.8")).not.toBe(code);
  });
});

describe("SharedRateLimiter", () => {
  const window = (answer: Awaited<ReturnType<WindowClient["limit"]>>) => {
    const seen: string[] = [];
    const client: WindowClient = {
      limit: (id) => {
        seen.push(id);
        return Promise.resolve(answer);
      },
    };
    return { client, seen };
  };

  it("passes what Redis allows and keys it by the pseudonym", async () => {
    const { client, seen } = window({ success: true, reset: NOW });
    const limiter = new SharedRateLimiter({
      window: client,
      fallback: memory(),
      secret: SECRET,
      now: () => NOW,
    });
    expect(await limiter.check("203.0.113.7")).toEqual({ ok: true, retryAfter: 0 });
    expect(seen).toEqual([pseudonym(SECRET, "203.0.113.7")]);
  });

  it("refuses with the seconds until the shared window frees up", async () => {
    const { client } = window({ success: false, reset: NOW + 12_300 });
    const limiter = new SharedRateLimiter({
      window: client,
      fallback: memory(),
      secret: SECRET,
      now: () => NOW,
    });
    expect(await limiter.check("a")).toEqual({ ok: false, retryAfter: 13 });
    const soon = new SharedRateLimiter({
      window: window({ success: false, reset: NOW }).client,
      fallback: memory(),
      secret: SECRET,
      now: () => NOW,
    });
    expect((await soon.check("a")).retryAfter).toBe(1);
  });

  it("lets memory decide when Redis times out, and says so", async () => {
    const { client } = window({ success: true, reset: NOW, reason: "timeout" });
    const limiter = new SharedRateLimiter({
      window: client,
      fallback: memory(),
      secret: SECRET,
      now: () => NOW,
    });
    expect((await limiter.check("a")).ok).toBe(true);
    expect((await limiter.check("a")).ok).toBe(false);
    expect(warnings[0]).toContain('"event":"limits_local","reason":"redis_unavailable"');
  });

  it("falls back to memory when the real client cannot reach Redis", async () => {
    const redis = connectRedis(UNREACHABLE);
    const shared = sharedWindow(redis, "plan", 8);
    expect(shared).toBeInstanceOf(Ratelimit);
    const limiter = new SharedRateLimiter({ window: shared, fallback: memory(), secret: SECRET });
    expect((await limiter.check("a")).ok).toBe(true);
    expect((await limiter.check("a")).ok).toBe(false);
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe("SharedDailyCap", () => {
  const caps = { total: 3, client: 2 };

  it("counts per day and per pseudonymous client, expiring at the next UTC midnight", async () => {
    const redis = new FakeScript();
    const cap = new SharedDailyCap({
      redis,
      caps,
      fallback: new DailyCap({ cap: 1 }),
      secret: SECRET,
      now: () => NOW,
    });
    expect(await cap.take("203.0.113.7")).toBe(true);
    expect(redis.calls[0]).toEqual({
      keys: [
        "shamiyana:daily:2026-10-23",
        `shamiyana:daily:2026-10-23:${pseudonym(SECRET, "203.0.113.7")}`,
      ],
      args: [3, 2, Date.parse("2026-10-24T00:00:00Z") / 1000],
    });
  });

  it("stops a client at its cap without using up anyone else's day", async () => {
    const redis = new FakeScript();
    const cap = new SharedDailyCap({
      redis,
      caps,
      fallback: new DailyCap({ cap: 1 }),
      secret: SECRET,
      now: () => NOW,
    });
    expect(await cap.take("a")).toBe(true);
    expect(await cap.take("a")).toBe(true);
    expect(await cap.take("a")).toBe(false);
    expect(await cap.take("a")).toBe(false);
    expect(await cap.take("b")).toBe(true);
    expect(await cap.take("c")).toBe(false);
    expect(await cap.take()).toBe(false);
  });

  it("falls back to this instance's cap when Redis fails", async () => {
    const cap = new SharedDailyCap({
      redis: connectRedis(UNREACHABLE),
      caps,
      fallback: new DailyCap({ cap: 1 }),
      secret: SECRET,
    });
    expect(await cap.take("a")).toBe(true);
    expect(await cap.take("a")).toBe(false);
    expect(warnings.some((line) => line.includes("redis_unavailable"))).toBe(true);
  });
});

describe("live dependencies", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("share the limits through Redis when it and the AI key are set, and still answer when Redis is down", async () => {
    vi.resetModules();
    vi.stubEnv("KV_REST_API_URL", UNREACHABLE.url);
    vi.stubEnv("KV_REST_API_TOKEN", SECRET);
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
    const handlers = await import("@/lib/server/handlers");
    const shared = await import("@/lib/server/shared-limits");
    const deps = handlers.liveDeps();
    expect(deps.limiters.plan).toBeInstanceOf(shared.SharedRateLimiter);
    expect(deps.limiters.refine).toBeInstanceOf(shared.SharedRateLimiter);
    expect(deps.limiters.vision).toBeInstanceOf(shared.SharedRateLimiter);
    expect(deps.daily).toBeInstanceOf(shared.SharedDailyCap);
    // an unknown language fails validation after the limit, so no model is called
    const response = await handlers.planHandler(handlers.liveDeps)(
      jsonPost({ facts: weddingFacts, locale: "xx", today: new Date().toISOString().slice(0, 10) }),
    );
    expect(response.status).toBe(422);
    expect(warnings.some((line) => line.includes("redis_unavailable"))).toBe(true);
  });

  it("keep the limits in memory without an AI key, since the AI routes refuse then", async () => {
    vi.resetModules();
    vi.stubEnv("KV_REST_API_URL", UNREACHABLE.url);
    vi.stubEnv("KV_REST_API_TOKEN", SECRET);
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    const handlers = await import("@/lib/server/handlers");
    const limits = await import("@/lib/server/rate-limit");
    const deps = handlers.liveDeps();
    expect(deps.limiters.plan).toBeInstanceOf(limits.RateLimiter);
    expect(deps.daily).toBeInstanceOf(limits.DailyCap);
  });
});
