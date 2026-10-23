// @vitest-environment jsdom
import {
  PlanStore,
  QUARANTINE_KEY,
  STORE_KEY,
  browserStorage,
  readStore,
  sharedStore,
  writeStore,
} from "@/lib/client/plan-store";
import { EMPTY_STORE } from "@/lib/plan/plans";
import { recordFor, weddingBrief } from "@/tests/helpers/fixtures";
import { MemoryStorage } from "@/tests/helpers/storage";

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

  it("reads and deletes the set-aside copy, and does nothing without storage", () => {
    const storage = new MemoryStorage();
    storage.setItem(QUARANTINE_KEY, "{not json");
    const store = new PlanStore(() => storage);
    expect(store.readUnreadable()).toBe("{not json");
    store.deleteUnreadable();
    expect(store.readUnreadable()).toBeNull();
    const blocked = new PlanStore(() => null);
    expect(blocked.readUnreadable()).toBeNull();
    expect(() => {
      blocked.deleteUnreadable();
    }).not.toThrow();
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
});
