import { planHandler } from "@/lib/server/plan-handler";
import { DailyCap } from "@/lib/server/rate-limit";
import { refineHandler } from "@/lib/server/refine-handler";
import { visionHandler } from "@/lib/server/vision-handler";
import { formPost, generatingModel, jsonPost, spec, testDeps } from "../helpers/ai";
import { TODAY, weddingFacts } from "../helpers/fixtures";

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("every route", () => {
  it("answers a bare 500 when something unexpected throws", async () => {
    const broken = () => {
      throw new Error("boom");
    };
    const plan = await planHandler(broken)(jsonPost({}));
    expect(plan.status).toBe(500);
    expect(await plan.json()).toEqual({ error: "internal" });
    expect((await refineHandler(broken)(jsonPost({}))).status).toBe(500);
    expect((await visionHandler(broken)(formPost(new FormData()))).status).toBe(500);
  });

  it("logs what went wrong by its class name only, never its message", async () => {
    const typeError = () => {
      throw new TypeError("Priya's wedding in Jaipur");
    };
    const thrown: unknown = "a bare string";
    const notAnError = () => {
      throw thrown;
    };
    await planHandler(typeError)(jsonPost({}));
    await refineHandler(notAnError)(jsonPost({}));
    const lines = vi.mocked(console.error).mock.calls.map((call) => String(call[0]));
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('"route":"plan","ms":');
    expect(lines[0]).toContain('"outcome":"internal","status":500,"errorType":"TypeError"');
    expect(lines[1]).toContain('"errorType":"string"');
    expect(lines.join("\n")).not.toContain("Jaipur");
    expect(lines.join("\n")).not.toContain("bare string");
  });

  it("stops one client at its own daily allowance while others carry on", async () => {
    const deps = testDeps([spec(generatingModel(JSON.stringify({ reply: "ok", changes: [] })))], {
      daily: new DailyCap({ cap: 100, clientCap: 1 }),
    });
    const body = {
      facts: weddingFacts,
      factors: {},
      locale: "en",
      today: TODAY,
      history: [],
      message: "hi",
    };
    vi.stubEnv("VERCEL", "1");
    const as = (ip: string) => jsonPost(body, { "x-vercel-forwarded-for": ip });
    expect((await refineHandler(() => deps)(as("198.51.100.1"))).status).toBe(200);
    expect(await (await refineHandler(() => deps)(as("198.51.100.1"))).json()).toEqual({
      error: "daily_cap",
    });
    expect((await refineHandler(() => deps)(as("198.51.100.2"))).status).toBe(200);
  });
});
