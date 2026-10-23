import { jsonPost } from "../helpers/ai";
import { weddingFacts } from "../helpers/fixtures";

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

describe("live dependencies", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("share the limits through Redis when it and the AI key are set, and still answer when Redis is down", async () => {
    vi.resetModules();
    vi.stubEnv("KV_REST_API_URL", UNREACHABLE.url);
    vi.stubEnv("KV_REST_API_TOKEN", SECRET);
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
    const { liveDeps } = await import("@/lib/server/deps");
    const { planHandler } = await import("@/lib/server/plan-handler");
    const shared = await import("@/lib/server/shared-limits");
    const deps = liveDeps();
    expect(deps.limiters.plan).toBeInstanceOf(shared.SharedRateLimiter);
    expect(deps.limiters.refine).toBeInstanceOf(shared.SharedRateLimiter);
    expect(deps.limiters.vision).toBeInstanceOf(shared.SharedRateLimiter);
    expect(deps.daily).toBeInstanceOf(shared.SharedDailyCap);
    // an unknown language fails validation after the limit, so no model is called
    const response = await planHandler(liveDeps)(
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
    const { liveDeps } = await import("@/lib/server/deps");
    const limits = await import("@/lib/server/rate-limit");
    const deps = liveDeps();
    expect(deps.limiters.plan).toBeInstanceOf(limits.RateLimiter);
    expect(deps.daily).toBeInstanceOf(limits.DailyCap);
  });
});
