import { healthHandler, planHandler, refineHandler, visionHandler } from "@/lib/server/handlers";
import { DailyCap, RateLimiter } from "@/lib/server/rate-limit";
import { TODAY, sampleEnrichment, weddingFacts } from "../fixtures";
import {
  JPEG,
  brokenGenerateModel,
  brokenStreamModel,
  formPost,
  generatingModel,
  jsonPost,
  spec,
  streamingModel,
  testDeps,
} from "../helpers/ai";

const planBody = { facts: weddingFacts, locale: "en", today: TODAY };
const answer = JSON.stringify(sampleEnrichment);
const halves = [answer.slice(0, 40), answer.slice(40)];

beforeEach(() => {
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
    const lines = vi.mocked(console.warn).mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.includes('"model":"second"') && l.includes('"outcome":"ok"'))).toBe(
      true,
    );
    expect(
      vi.mocked(console.error).mock.calls.some((c) => String(c[0]).includes('"model":"first"')),
    ).toBe(true);
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

describe("POST /api/refine", () => {
  const body = {
    facts: weddingFacts,
    factors: {},
    locale: "en",
    today: TODAY,
    history: [],
    message: "Cut decor by a bit",
  };
  const reply = JSON.stringify({
    reply: "Moved some decor money to food.",
    changes: [{ op: "shift_category", category: "decor", factor: 0.8 }, { op: "launch_rocket" }],
  });

  it("returns the reply and only valid changes", async () => {
    const model = generatingModel(reply);
    const response = await refineHandler(() => testDeps([spec(model)]))(jsonPost(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      reply: "Moved some decor money to food.",
      changes: [{ op: "shift_category", category: "decor", factor: 0.8 }],
    });
    expect(JSON.stringify(model.doGenerateCalls[0]?.prompt)).toContain("Cut decor by a bit");
  });

  it("passes earlier turns to the model as fenced user text", async () => {
    const model = generatingModel(reply);
    const history = [
      { role: "user", text: "Make it smaller" },
      { role: "assistant", text: "Done <b>" },
    ];
    const response = await refineHandler(() => testDeps([spec(model)]))(
      jsonPost({ ...body, history }),
    );
    expect(response.status).toBe(200);
    expect(JSON.stringify(model.doGenerateCalls[0]?.prompt)).toContain(
      "assistant: <user_text>Done b</user_text>",
    );
  });

  it("falls back across models and fails cleanly", async () => {
    const ok = await refineHandler(() =>
      testDeps([spec(brokenGenerateModel()), spec(generatingModel(reply))]),
    )(jsonPost(body));
    expect(ok.status).toBe(200);
    const failed = await refineHandler(() => testDeps([spec(generatingModel("not json"))]))(
      jsonPost(body),
    );
    expect(await failed.json()).toEqual({ error: "ai_failed" });
  });

  it.each([
    ["no AI key", null, body, "ai_unavailable"],
    ["bad JSON", [], "]", "bad_request"],
    ["an empty message", [], { ...body, message: "  " }, "invalid"],
    [
      "a long history",
      [],
      { ...body, history: Array.from({ length: 7 }, () => ({ role: "user", text: "hi" })) },
      "invalid",
    ],
    ["a factor out of range", [], { ...body, factors: { decor: 4 } }, "invalid"],
  ])("rejects %s", async (_label, chain, payload, code) => {
    const deps = testDeps(chain === null ? null : [spec(generatingModel(reply))]);
    expect(await (await refineHandler(() => deps)(jsonPost(payload))).json()).toEqual({
      error: code,
    });
  });

  it("stops at the daily cap and on the guard", async () => {
    const capped = testDeps([spec(generatingModel(reply))], { daily: new DailyCap(0) });
    expect(await (await refineHandler(() => capped)(jsonPost(body))).json()).toEqual({
      error: "daily_cap",
    });
    const crossSite = await refineHandler(() => capped)(
      jsonPost(body, { "sec-fetch-site": "cross-site" }),
    );
    expect(crossSite.status).toBe(403);
  });
});

describe("POST /api/vision", () => {
  const fields = JSON.stringify({ facts: weddingFacts, locale: "hi", today: TODAY });
  const vision = JSON.stringify({
    kind: "decor",
    mood: "Warm and festive",
    palette: [
      { name: "Marigold", hex: "#F39B2D" },
      { name: "Bad", hex: "orange" },
    ],
    ideas: [{ area: "decor", title: "Genda phool torans", detail: "At every doorway." }],
    notes: ["Low ceiling"],
  });

  function form(image: Uint8Array | string | null, extra?: string) {
    const data = new FormData();
    if (image instanceof Uint8Array)
      data.set("image", new File([image as BlobPart], "x.jpg", { type: "image/png" }));
    else if (image !== null) data.set("image", image);
    data.set("fields", extra ?? fields);
    return data;
  }

  it("sniffs the real type, sends the image and returns sanitized insights", async () => {
    const model = generatingModel(vision);
    const response = await visionHandler(() => testDeps([spec(model)]))(formPost(form(JPEG)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      kind: "decor",
      mood: "Warm and festive",
      palette: [{ name: "Marigold", hex: "#f39b2d" }],
      ideas: [{ area: "decor", title: "Genda phool torans", detail: "At every doorway." }],
      notes: ["Low ceiling"],
    });
    const prompt = JSON.stringify(model.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("image/jpeg");
    expect(prompt).toContain("Hindi in Devanagari script");
  });

  it.each([
    [
      "a file that is not an image",
      form(new TextEncoder().encode("<svg onload=alert(1)>")),
      "unsupported_media_type",
    ],
    ["a text field instead of a file", form("not a file"), "bad_request"],
    ["no image", form(null), "bad_request"],
    ["invalid fields", form(JPEG, "{}"), "invalid"],
    ["fields that are not JSON", form(JPEG, "{oops"), "bad_request"],
    ["fields over 16 KB", form(JPEG, JSON.stringify({ pad: "x".repeat(17_000) })), "too_large"],
  ])("rejects %s", async (_label, data, code) => {
    const response = await visionHandler(() => testDeps([spec(generatingModel(vision))]))(
      formPost(data),
    );
    expect(await response.json()).toEqual({ error: code });
  });

  it("rejects a JSON body and a broken multipart body", async () => {
    const deps = testDeps([spec(generatingModel(vision))]);
    expect((await visionHandler(() => deps)(jsonPost({}))).status).toBe(415);
    const broken = await visionHandler(() => deps)(
      jsonPost("garbage", { "content-type": "multipart/form-data; boundary=zzz" }),
    );
    expect(await broken.json()).toEqual({ error: "bad_request" });
  });

  it("rejects an oversized image", async () => {
    const big = new Uint8Array(4 * 1024 * 1024 + 1);
    big.set(JPEG);
    const response = await visionHandler(() => testDeps([spec(generatingModel(vision))]))(
      formPost(form(big)),
    );
    expect(response.status).toBe(413);
  });

  it("fails cleanly without a key, past the cap, or with an empty answer", async () => {
    expect(await (await visionHandler(() => testDeps(null))(formPost(form(JPEG)))).json()).toEqual({
      error: "ai_unavailable",
    });
    const capped = testDeps([spec(generatingModel(vision))], { daily: new DailyCap(0) });
    expect(await (await visionHandler(() => capped)(formPost(form(JPEG)))).json()).toEqual({
      error: "daily_cap",
    });
    const empty = testDeps([spec(generatingModel('{"kind":"other","ideas":[],"palette":[]}'))]);
    expect(await (await visionHandler(() => empty)(formPost(form(JPEG)))).json()).toEqual({
      error: "ai_failed",
    });
  });

  it("refuses a cross-site upload", async () => {
    const response = await visionHandler(() => testDeps(null))(
      formPost(form(JPEG), { "sec-fetch-site": "cross-site" }),
    );
    expect(response.status).toBe(403);
  });
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
  it("reports whether AI is configured, without secrets", async () => {
    const on = (await healthHandler(() => testDeps([spec(streamingModel([]))]))().json()) as Record<
      string,
      unknown
    >;
    expect(Object.keys(on).sort()).toEqual(["ai", "prompts", "status"]);
    expect(on).toMatchObject({ status: "ok", ai: "configured" });
    expect(await healthHandler(() => testDeps(null))().json()).toMatchObject({ ai: "off" });
  });
});
