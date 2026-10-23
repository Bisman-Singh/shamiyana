// @vitest-environment jsdom
import {
  errorCode,
  errorFromMessage,
  requestRefine,
  requestVision,
  type RefineRequest,
} from "@/lib/client/api";
import { TODAY, weddingFacts } from "../helpers/fixtures";
import { jsonError, mockFetch } from "../helpers/fetch";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("maps error bodies and statuses to known codes", () => {
    expect(errorCode({ error: "daily_cap" }, 503)).toBe("daily_cap");
    expect(errorCode({ error: "weird" }, 429)).toBe("rate_limited");
    expect(errorCode(null, 422)).toBe("invalid");
    expect(errorCode("text", 500)).toBe("ai_failed");
    expect(errorFromMessage('{"error":"ai_unavailable"}')).toBe("ai_unavailable");
    expect(errorFromMessage("Failed to fetch")).toBe("network");
  });

  const refineBody: RefineRequest = {
    facts: weddingFacts,
    factors: {},
    locale: "en",
    today: TODAY,
    history: [],
    message: "Fewer guests",
  };

  it("validates a refine answer and keeps only valid changes", async () => {
    mockFetch({
      "/api/refine": () =>
        Response.json({
          reply: "Done.",
          changes: [{ op: "set_guests", count: 90 }, { op: "nope" }],
        }),
    });
    const result = await requestRefine(refineBody, ["venue"], TODAY);
    expect(result).toEqual({
      ok: true,
      data: { reply: "Done.", changes: [{ op: "set_guests", count: 90 }] },
    });
  });

  it("treats a malformed answer, a failed response or no network as errors", async () => {
    mockFetch({
      "/api/refine": () => Response.json({ reply: 5 }),
      "/api/vision": () => Response.json({ kind: "x" }),
    });
    expect(await requestRefine(refineBody, [], TODAY)).toEqual({ ok: false, error: "ai_failed" });
    expect(await requestVision(new FormData())).toEqual({ ok: false, error: "ai_failed" });
    mockFetch({
      "/api/vision": () => jsonError("rate_limited", 429),
      "/api/refine": () => new Response("oops", { status: 500 }),
    });
    expect(await requestVision(new FormData())).toEqual({ ok: false, error: "rate_limited" });
    expect(await requestRefine(refineBody, [], TODAY)).toEqual({ ok: false, error: "ai_failed" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("offline"))),
    );
    expect(await requestVision(new FormData())).toEqual({ ok: false, error: "network" });
  });

  it("accepts a valid vision answer", async () => {
    const data = { kind: "decor", mood: "Warm", palette: [], ideas: [], notes: [] };
    mockFetch({ "/api/vision": () => Response.json(data) });
    expect(await requestVision(new FormData())).toEqual({ ok: true, data });
  });
});
