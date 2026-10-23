// @vitest-environment jsdom
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
import { recordFor, sampleEnrichment, weddingBrief } from "../helpers/fixtures";
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
