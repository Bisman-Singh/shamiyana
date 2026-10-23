import { healthHandler, planHandler, refineHandler, visionHandler } from "@/lib/server/handlers";
import { DailyCap } from "@/lib/server/rate-limit";
import { TODAY, weddingFacts } from "../fixtures";
import { formPost, generatingModel, jsonPost, spec, testDeps } from "../helpers/ai";

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
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

  it("stops one client at its own daily allowance while others carry on", async () => {
    const deps = testDeps([spec(generatingModel(JSON.stringify({ reply: "ok", changes: [] })))], {
      daily: new DailyCap(100, 1),
    });
    const body = {
      facts: weddingFacts,
      factors: {},
      locale: "en",
      today: TODAY,
      history: [],
      message: "hi",
    };
    const as = (ip: string) => jsonPost(body, { "x-real-ip": ip });
    expect((await refineHandler(() => deps)(as("198.51.100.1"))).status).toBe(200);
    expect(await (await refineHandler(() => deps)(as("198.51.100.1"))).json()).toEqual({
      error: "daily_cap",
    });
    expect((await refineHandler(() => deps)(as("198.51.100.2"))).status).toBe(200);
  });
});

describe("GET /api/health", () => {
  it("says only that the server is up, never how it is configured", async () => {
    const response = healthHandler();
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
