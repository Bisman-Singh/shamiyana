import { planHandler } from "@/lib/server/handlers";
import { DailyCap, RateLimiter } from "@/lib/server/rate-limit";
import { TODAY, sampleEnrichment, weddingFacts } from "../helpers/fixtures";
import {
  brokenStreamModel,
  cutOffModel,
  hangingModel,
  jsonPost,
  spec,
  streamingModel,
  testDeps,
} from "../helpers/ai";

const planBody = { facts: weddingFacts, locale: "en", today: TODAY };
const answer = JSON.stringify(sampleEnrichment);
const halves = [answer.slice(0, 40), answer.slice(40)];

/** Info-level log lines from the current test. */
const infoLines: string[] = [];

beforeEach(() => {
  infoLines.length = 0;
  vi.spyOn(console, "info").mockImplementation((line: unknown) => {
    infoLines.push(String(line));
  });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("POST /api/plan", () => {
  it("streams the model's JSON as text", async () => {
    const model = streamingModel(halves);
    const response = await planHandler(() => testDeps([spec(model)]))(jsonPost(planBody));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.parse(await response.text())).toEqual(sampleEnrichment);
    const prompt = JSON.stringify(model.doStreamCalls[0]?.prompt);
    expect(prompt).toContain("City: <user_text>Jaipur</user_text>");
    expect(prompt).not.toContain("Winter wedding in Jaipur");
    expect(model.doStreamCalls[0]?.maxOutputTokens).toBe(4_000);
    expect(model.doStreamCalls[0]?.responseFormat?.type).toBe("json");
  });

  it("falls back to the next model when the first fails before answering", async () => {
    const deps = testDeps([
      spec(brokenStreamModel(), "first"),
      spec(streamingModel(halves), "second"),
    ]);
    const response = await planHandler(() => deps)(jsonPost(planBody));
    expect(JSON.parse(await response.text())).toEqual(sampleEnrichment);
    expect(
      infoLines.some((l) => l.includes('"model":"second"') && l.includes('"outcome":"ok"')),
    ).toBe(true);
    expect(
      vi.mocked(console.error).mock.calls.some((c) => String(c[0]).includes('"model":"first"')),
    ).toBe(true);
  });

  it("logs an answer that stops partway as cut off, after the text that arrived", async () => {
    const deps = testDeps([spec(cutOffModel([answer.slice(0, 40)]), "flaky")]);
    const response = await planHandler(() => deps)(jsonPost(planBody));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(answer.slice(0, 40));
    const errors = vi.mocked(console.error).mock.calls.map((c) => String(c[0]));
    expect(
      errors.some((l) => l.includes('"outcome":"cut_off"') && l.includes('"model":"flaky"')),
    ).toBe(true);
    expect(infoLines.some((l) => l.includes("cut_off"))).toBe(false);
  });

  it("does not log a complete answer as cut off", async () => {
    await (
      await planHandler(() => testDeps([spec(streamingModel(halves))]))(jsonPost(planBody))
    ).text();
    expect(vi.mocked(console.error).mock.calls.some((c) => String(c[0]).includes("cut_off"))).toBe(
      false,
    );
  });

  it("answers 502 when every model fails", async () => {
    const response = await planHandler(() => testDeps([spec(brokenStreamModel())]))(
      jsonPost(planBody),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "ai_failed" });
  });

  it("serves a repeat brief from cache without calling the model or the daily cap", async () => {
    const model = streamingModel(halves);
    const daily = new DailyCap(1);
    const deps = testDeps([spec(model)], { daily });
    await (await planHandler(() => deps)(jsonPost(planBody))).text();
    const again = await planHandler(() => deps)(jsonPost(planBody));
    expect(JSON.parse(await again.text())).toEqual(sampleEnrichment);
    expect(model.doStreamCalls).toHaveLength(1);
  });

  it("skips the cache when fresh ideas are asked for", async () => {
    const model = streamingModel(halves);
    const deps = testDeps([spec(model)]);
    await (await planHandler(() => deps)(jsonPost(planBody))).text();
    await (await planHandler(() => deps)(jsonPost({ ...planBody, fresh: true }))).text();
    expect(model.doStreamCalls).toHaveLength(2);
  });

  it("does not cache an answer that has nothing usable", async () => {
    const model = streamingModel(['{"theme":']);
    const deps = testDeps([spec(model)]);
    await (await planHandler(() => deps)(jsonPost(planBody))).text();
    expect(deps.cache.size).toBe(0);
  });

  it.each([
    ["no AI key", null, planBody, 503, "ai_unavailable"],
    ["bad JSON", [], "{nope", 400, "bad_request"],
    ["an unknown field", [], { ...planBody, admin: true }, 422, "invalid"],
    ["an unsupported locale", [], { ...planBody, locale: "fr" }, 422, "invalid"],
    [
      "a past event",
      [],
      { ...planBody, facts: { ...weddingFacts, date: "2026-10-01" } },
      422,
      "invalid",
    ],
    [
      "an event too far out",
      [],
      { ...planBody, facts: { ...weddingFacts, date: "2030-01-01" } },
      422,
      "invalid",
    ],
    [
      "a device clock far from the server",
      [],
      { ...planBody, today: "2026-10-25" },
      422,
      "invalid",
    ],
    ["a malformed today", [], { ...planBody, today: "today" }, 422, "invalid"],
  ])("rejects %s", async (_label, chain, body, status, code) => {
    const deps = testDeps(chain === null ? null : [spec(streamingModel(halves))]);
    const response = await planHandler(() => deps)(jsonPost(body));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: code });
  });

  it("answers ai_failed when no model starts before the deadline", async () => {
    const response = await planHandler(() => testDeps([spec(hangingModel())], { deadlineMs: 50 }))(
      jsonPost(planBody),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "ai_failed" });
  });

  it("stops at the daily cap", async () => {
    const deps = testDeps([spec(streamingModel(halves))], { daily: new DailyCap(0 + 1) });
    await (await planHandler(() => deps)(jsonPost({ ...planBody, fresh: true }))).text();
    const second = await planHandler(() => deps)(jsonPost({ ...planBody, fresh: true }));
    expect(await second.json()).toEqual({ error: "daily_cap" });
  });

  it("rate-limits per client and says when to retry", async () => {
    const deps = testDeps([spec(streamingModel(halves))], {
      limiters: {
        plan: new RateLimiter({ limit: 0 + 1, windowMs: 60_000 }),
        refine: new RateLimiter({ limit: 1, windowMs: 60_000 }),
        vision: new RateLimiter({ limit: 1, windowMs: 60_000 }),
      },
    });
    await (await planHandler(() => deps)(jsonPost(planBody))).text();
    const limited = await planHandler(() => deps)(jsonPost(planBody));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
  });
});
