// @vitest-environment jsdom
import { errorCode, errorFromMessage, requestRefine, requestVision } from "@/lib/client/api";
import { downloadText, prepareImage, readTextFile } from "@/lib/client/files";
import {
  EMPTY_STORE,
  PlanStore,
  QUARANTINE_KEY,
  STORE_KEY,
  activePlan,
  browserStorage,
  canAddPlan,
  parseBackup,
  putPlan,
  readStore,
  removePlan,
  savePlan,
  selectPlan,
  sharedStore,
  writeStore,
} from "@/lib/client/plan-store";
import { LIMITS } from "@/lib/plan/constants";
import { TODAY, recordFor, sampleEnrichment, weddingBrief } from "../fixtures";
import { stubCanvas, stubObjectUrls } from "../helpers/browser";
import { jsonError, mockFetch } from "../helpers/fetch";
import { MemoryStorage } from "../helpers/storage";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("plan storage", () => {
  const plan = recordFor(weddingBrief);
  const store = { version: 1 as const, activeId: plan.id, plans: [plan] };

  it("writes and reads a validated store", () => {
    const storage = new MemoryStorage();
    expect(writeStore(storage, store)).toBeNull();
    expect(readStore(storage)).toEqual({ data: store, notice: null });
    expect(readStore(new MemoryStorage())).toEqual({ data: EMPTY_STORE, notice: null });
  });

  it("sets unreadable data aside instead of deleting it", () => {
    for (const raw of ["{broken", JSON.stringify({ version: 2 })]) {
      const storage = new MemoryStorage();
      storage.setItem(STORE_KEY, raw);
      expect(readStore(storage)).toEqual({ data: EMPTY_STORE, notice: "recovered" });
      expect(storage.getItem(QUARANTINE_KEY)).toBe(raw);
      expect(storage.getItem(STORE_KEY)).toBeNull();
    }
  });

  it("still recovers when storage refuses to write the quarantine copy", () => {
    const storage = new MemoryStorage();
    storage.setItem(STORE_KEY, "{broken");
    storage.failWrites = true;
    expect(readStore(storage).notice).toBe("recovered");
  });

  it("reports blocked and full storage", () => {
    expect(readStore(null)).toEqual({ data: EMPTY_STORE, notice: "blocked" });
    expect(writeStore(null, store)).toBe("blocked");
    const full = new MemoryStorage();
    full.failWrites = true;
    expect(writeStore(full, store)).toBe("full");
  });

  it("detects whether the browser allows storage", () => {
    expect(browserStorage()).toBe(window.localStorage);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(browserStorage()).toBeNull();
  });

  it("notifies subscribers, follows other tabs and stops listening when unsubscribed", () => {
    const storage = new MemoryStorage();
    const plans = new PlanStore(() => storage);
    expect(plans.getServerSnapshot().ready).toBe(false);
    const listener = vi.fn();
    const off = plans.subscribe(listener);
    expect(plans.getSnapshot().ready).toBe(true);
    plans.commit(store);
    expect(listener).toHaveBeenCalled();
    writeStore(storage, EMPTY_STORE);
    window.dispatchEvent(new StorageEvent("storage", { key: "other" }));
    expect(plans.getSnapshot().data).toEqual(store);
    window.dispatchEvent(new StorageEvent("storage", { key: STORE_KEY }));
    expect(plans.getSnapshot().data).toEqual(EMPTY_STORE);
    const second = vi.fn();
    const offSecond = plans.subscribe(second);
    off();
    offSecond();
    plans.dismissNotice();
    expect(plans.getSnapshot().notice).toBeNull();
    expect(sharedStore()).toBe(sharedStore());
  });

  it("adds, replaces, selects and removes plans", () => {
    const other = recordFor(weddingBrief, { id: "other" });
    let data = putPlan(EMPTY_STORE, plan);
    data = putPlan(data, other);
    expect(activePlan(data)?.id).toBe("other");
    data = putPlan(data, { ...plan, brief: { ...plan.brief, guests: 10 } });
    expect(data.plans).toHaveLength(2);
    expect(activePlan(data)?.brief.guests).toBe(10);
    expect(selectPlan(data, "missing").activeId).toBeNull();
    expect(selectPlan(data, null).activeId).toBeNull();
    expect(removePlan(data, plan.id).activeId).toBe("other");
    expect(removePlan(data, "other").activeId).toBe(plan.id);
    expect(removePlan(removePlan(data, "other"), plan.id).activeId).toBeNull();
    expect(activePlan(EMPTY_STORE)).toBeNull();
    expect(savePlan(data, { ...other, hidden: ["x"] }).plans[1]?.hidden).toEqual(["x"]);
    expect(savePlan(data, recordFor(weddingBrief, { id: "ghost" })).plans).toEqual(data.plans);
  });

  it("checks backups and room for them", () => {
    const fullStore = {
      ...EMPTY_STORE,
      plans: Array.from({ length: LIMITS.plansMax }, (_, i) =>
        recordFor(weddingBrief, { id: `p${i}` }),
      ),
    };
    expect(canAddPlan(fullStore)).toBe(false);
    expect(parseBackup(JSON.stringify(plan), EMPTY_STORE)).toEqual({ ok: true, record: plan });
    expect(parseBackup(JSON.stringify(plan), fullStore)).toEqual({ ok: false, reason: "full" });
    expect(parseBackup(JSON.stringify({ ...plan, id: "p3" }), fullStore).ok).toBe(true);
    const tricky = recordFor(weddingBrief, {
      enrichment: {
        ...sampleEnrichment,
        risks: [{ risk: "Rain\u2066", mitigation: "Tent\u0007" }],
      },
    });
    const restored = parseBackup(JSON.stringify(tricky), EMPTY_STORE);
    expect(restored.ok && restored.record.enrichment?.risks).toEqual([
      { risk: "Rain", mitigation: "Tent" },
    ]);
    expect(parseBackup(null, EMPTY_STORE)).toEqual({ ok: false, reason: "bad" });
    expect(parseBackup("[]", EMPTY_STORE)).toEqual({ ok: false, reason: "bad" });
  });
});

describe("files", () => {
  it("downloads text through a temporary link", () => {
    const { revoke } = stubObjectUrls("blob:file");
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    downloadText("plan.csv", "text/csv", "a,b");
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:file");
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("scales a large photo down to 1600px and re-encodes it as JPEG", async () => {
    const { close, toBlob } = stubCanvas({ width: 4000, height: 3000 });
    let size: [number, number] = [0, 0];
    toBlob.mockImplementation(function (this: HTMLCanvasElement, done, type) {
      size = [this.width, this.height];
      done(new Blob(["x"], { type: type ?? "" }));
    });
    const blob = await prepareImage(new File(["p"], "a.webp", { type: "image/webp" }));
    expect(blob.type).toBe("image/jpeg");
    expect(size).toEqual([1600, 1200]);
    expect(close).toHaveBeenCalled();
  });

  it("refuses non-images and fails cleanly without a canvas", async () => {
    await expect(prepareImage(new File(["p"], "a.svg", { type: "image/svg+xml" }))).rejects.toThrow(
      TypeError,
    );
    stubCanvas();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    await expect(prepareImage(new File(["p"], "a.png", { type: "image/png" }))).rejects.toThrow(
      "canvas",
    );
  });

  it("reads small text files only", async () => {
    expect(await readTextFile(new File(["hello"], "a.json"), 10)).toBe("hello");
    expect(await readTextFile(new File(["hello world"], "a.json"), 5)).toBeNull();
  });
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

  it("validates a refine answer and keeps only valid changes", async () => {
    mockFetch({
      "/api/refine": () =>
        Response.json({
          reply: "Done.",
          changes: [{ op: "set_guests", count: 90 }, { op: "nope" }],
        }),
    });
    const result = await requestRefine({}, ["venue"], TODAY);
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
    expect(await requestRefine({}, [], TODAY)).toEqual({ ok: false, error: "ai_failed" });
    expect(await requestVision(new FormData())).toEqual({ ok: false, error: "ai_failed" });
    mockFetch({
      "/api/vision": () => jsonError("rate_limited", 429),
      "/api/refine": () => new Response("oops", { status: 500 }),
    });
    expect(await requestVision(new FormData())).toEqual({ ok: false, error: "rate_limited" });
    expect(await requestRefine({}, [], TODAY)).toEqual({ ok: false, error: "ai_failed" });
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
