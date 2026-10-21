import { NextRequest } from "next/server";
import nextConfig, { securityHeaders } from "@/next.config";
import { buildCsp, config, proxy } from "@/proxy";
import { SAME_ORIGIN } from "../helpers/ai";
import { TODAY, weddingBrief } from "../fixtures";

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("content security policy", () => {
  it("allows only this page's nonce for scripts and styles in production", () => {
    const csp = buildCsp("abc", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'nonce-abc'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("relaxes only what the dev server needs", () => {
    const csp = buildCsp("abc", true);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("sets a fresh nonce on the request and the response", () => {
    const first = proxy(new NextRequest("https://plan.test/"));
    const second = proxy(new NextRequest("https://plan.test/"));
    const nonce = (r: Response) =>
      /nonce-([^']+)/.exec(r.headers.get("content-security-policy") ?? "")?.[1];
    expect(nonce(first)).toBeTruthy();
    expect(nonce(first)).not.toBe(nonce(second));
    expect(first.headers.get("x-middleware-request-x-nonce")).toBe(nonce(first));
    expect(config.matcher[0]?.source).toContain("?!api");
  });
});

describe("static headers", () => {
  it("sends HSTS, nosniff, frame and referrer policies everywhere and no-store on the API", async () => {
    const keys = securityHeaders.map((h) => h.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules.find((r) => r.source === "/api/:path*")?.headers).toEqual([
      { key: "Cache-Control", value: "no-store" },
    ]);
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

describe("route files", () => {
  const post = (body: unknown) =>
    new Request("https://plan.test/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json", ...SAME_ORIGIN },
      body: JSON.stringify(body),
    });

  it("answers 503 on every AI route when no key is configured", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    const plan = await import("@/app/api/plan/route");
    const refine = await import("@/app/api/refine/route");
    const vision = await import("@/app/api/vision/route");
    const health = await import("@/app/api/health/route");
    const res = await plan.POST(
      post({ brief: weddingBrief, locale: "en", today: new Date().toISOString().slice(0, 10) }),
    );
    expect(res.status).toBe(503);
    const refined = await refine.POST(
      post({
        brief: weddingBrief,
        factors: {},
        locale: "en",
        today: new Date().toISOString().slice(0, 10),
        history: [],
        message: "hi",
      }),
    );
    expect(refined.status).toBe(503);
    expect((await vision.POST(post({}))).status).toBe(415);
    expect(await health.GET().json()).toMatchObject({ status: "ok", ai: "off" });
    expect(plan.maxDuration).toBe(60);
    expect(health.dynamic).toBe("force-dynamic");
    expect(TODAY).toBeTruthy();
  });

  it("reuses one set of dependencies per process", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
    const { liveDeps } = await import("@/lib/server/handlers");
    expect(liveDeps()).toBe(liveDeps());
    expect(liveDeps().chain?.map((m) => m.id)).toEqual([
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-3.8-flash",
      "gemini-3.5-flash-lite",
    ]);
  });
});

describe("instrumentation", () => {
  it("validates the environment at boot and warns when AI is off", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    const { register } = await import("@/instrumentation");
    await register();
    expect(vi.mocked(console.warn).mock.calls.some((c) => String(c[0]).includes("ai_off"))).toBe(
      true,
    );
  });

  it("stays quiet with a key, skips the edge runtime and fails fast on bad config", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "k");
    const { register } = await import("@/instrumentation");
    await register();
    expect(console.warn).not.toHaveBeenCalled();
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await register();
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("AI_DAILY_REQUEST_CAP", "-1");
    await expect(register()).rejects.toThrow("AI_DAILY_REQUEST_CAP");
  });
});
