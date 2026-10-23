import { NextRequest } from "next/server";
import nextConfig, { securityHeaders } from "@/next.config";
import { buildCsp, config, proxy } from "@/proxy";
import { SAME_ORIGIN } from "@/tests/helpers/ai";
import { TODAY, weddingFacts } from "@/tests/helpers/fixtures";

beforeEach(() => {
  vi.resetModules();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("content security policy", () => {
  it("allows only this page's nonce for scripts and styles in production", () => {
    const csp = buildCsp("abc", false, true);
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'nonce-abc'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("img-src 'self' blob:;");
    expect(csp).not.toContain("data:");
  });

  it("relaxes only what the dev server needs", () => {
    const csp = buildCsp("abc", true, true);
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("upgrades insecure requests only on pages served over https", () => {
    expect(buildCsp("abc", false, true)).toContain("upgrade-insecure-requests");
    expect(buildCsp("abc", false, false)).not.toContain("upgrade-insecure-requests");
    const csp = (url: string, headers: Record<string, string> = {}) =>
      proxy(new NextRequest(url, { headers })).headers.get("content-security-policy") ?? "";
    expect(csp("https://plan.test/")).toContain("upgrade-insecure-requests");
    expect(csp("http://plan.test/", { "x-forwarded-proto": "https" })).toContain(
      "upgrade-insecure-requests",
    );
    expect(csp("http://localhost:3200/")).not.toContain("upgrade-insecure-requests");
  });

  it("puts the CSP on every page, prefetches and 404s included, and only skips the API, build assets and the icon", () => {
    const source = config.matcher[0]?.source ?? "";
    const matches = (path: string) => new RegExp(`^${source}$`).test(path);
    expect(config.matcher[0]).toEqual({ source });
    for (const page of [
      "/",
      "/privacy",
      "/api-docs",
      "/apix",
      "/icon.svg.html",
      "/favicon.icon",
      "/favicon.ico",
    ]) {
      expect(matches(page), page).toBe(true);
    }
    for (const skipped of ["/api/plan", "/_next/static/x.js", "/_next/image", "/icon.svg"]) {
      expect(matches(skipped), skipped).toBe(false);
    }
  });

  it("sets a fresh nonce on the request and the response", () => {
    const first = proxy(new NextRequest("https://plan.test/"));
    const second = proxy(new NextRequest("https://plan.test/"));
    const nonce = (response: Response) =>
      /nonce-([^']+)/.exec(response.headers.get("content-security-policy") ?? "")?.[1];
    expect(nonce(first)).toBeTruthy();
    expect(nonce(first)).not.toBe(nonce(second));
    expect(first.headers.get("x-middleware-request-x-nonce")).toBe(nonce(first));
    expect(config.matcher[0]?.source).toContain("?!api/");
  });
});

describe("static headers", () => {
  it("sends HSTS, nosniff, frame and referrer policies everywhere, and no-store and a deny-all CSP on the API", async () => {
    const keys = securityHeaders.map((header) => header.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Strict-Transport-Security",
        "X-Content-Type-Options",
        "X-Frame-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
    const policy =
      securityHeaders.find((header) => header.key === "Permissions-Policy")?.value ?? "";
    for (const feature of ["camera", "microphone", "geolocation", "payment", "browsing-topics"]) {
      expect(policy).toContain(`${feature}=()`);
    }
    // the share dialog copies the link and opens the share sheet
    expect(policy).not.toMatch(/clipboard-write|web-share/);
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules.find((rule) => rule.source === "/api/:path*")?.headers).toEqual([
      { key: "Cache-Control", value: "no-store" },
      { key: "Content-Security-Policy", value: "default-src 'none'; frame-ancestors 'none'" },
    ]);
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});

describe("route files", () => {
  it("answers a bare JSON 404 for an API path that doesn't exist", async () => {
    const missing = await import("@/app/api/[...path]/route");
    for (const handler of [missing.GET, missing.POST, missing.PUT, missing.PATCH, missing.DELETE]) {
      const response = handler();
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ error: "not_found" });
    }
  });

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
    const planned = await plan.POST(
      post({ facts: weddingFacts, locale: "en", today: new Date().toISOString().slice(0, 10) }),
    );
    expect(planned.status).toBe(503);
    const refined = await refine.POST(
      post({
        facts: weddingFacts,
        factors: {},
        locale: "en",
        today: new Date().toISOString().slice(0, 10),
        history: [],
        message: "hi",
      }),
    );
    expect(refined.status).toBe(503);
    expect((await vision.POST(post({}))).status).toBe(415);
    expect(await health.GET().json()).toEqual({ status: "ok" });
    expect(plan.maxDuration).toBe(60);
    expect(health.dynamic).toBe("force-dynamic");
    expect(TODAY).toBeTruthy();
  });

  it("reuses one set of dependencies per process", async () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key");
    const { liveDeps } = await import("@/lib/server/deps");
    expect(liveDeps()).toBe(liveDeps());
    expect(liveDeps().chain?.map((model) => model.id)).toEqual([
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-3.8-flash",
    ]);
  });
});

describe("instrumentation", () => {
  it("validates the environment at boot and warns when AI is off", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    const { register } = await import("@/instrumentation");
    await register();
    expect(
      vi.mocked(console.warn).mock.calls.some(([line]) => String(line).includes("ai_off")),
    ).toBe(true);
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
