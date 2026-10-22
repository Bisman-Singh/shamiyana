import { LIMITS } from "@/lib/plan/constants";
import { withCleanEnrichment } from "@/lib/plan/record";
import { planRecordSchema, storeSchema, type PlanRecord, type Store } from "@/lib/plan/schema";

/**
 * Plans live in localStorage under one versioned key, validated on every
 * read. Data that fails validation is moved aside, never silently deleted,
 * and the app starts clean. Other tabs pick up changes through the storage
 * event. The store is a tiny external store for `useSyncExternalStore`.
 */

export const STORE_KEY = "shamiyana:v1";
export const QUARANTINE_KEY = "shamiyana:unreadable";

export type Notice = "blocked" | "full" | "recovered";

export interface Snapshot {
  ready: boolean;
  data: Store;
  notice: Notice | null;
}

export const EMPTY_STORE: Store = { version: 1, activeId: null, plans: [] };
const SERVER_SNAPSHOT: Snapshot = { ready: false, data: EMPTY_STORE, notice: null };

export function readStore(storage: Storage | null): { data: Store; notice: Notice | null } {
  if (!storage) return { data: EMPTY_STORE, notice: "blocked" };
  const raw = storage.getItem(STORE_KEY);
  if (raw === null) return { data: EMPTY_STORE, notice: null };
  try {
    const parsed = storeSchema.safeParse(JSON.parse(raw));
    if (parsed.success) return { data: parsed.data, notice: null };
  } catch {
    // falls through to quarantine
  }
  try {
    storage.setItem(QUARANTINE_KEY, raw);
    storage.removeItem(STORE_KEY);
  } catch {
    // nothing more can be done if storage refuses
  }
  return { data: EMPTY_STORE, notice: "recovered" };
}

export function writeStore(storage: Storage | null, data: Store): Notice | null {
  if (!storage) return "blocked";
  try {
    storage.setItem(STORE_KEY, JSON.stringify(data));
    return null;
  } catch {
    return "full";
  }
}

/** localStorage if this browser lets us use it, else null. */
export function browserStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    const probe = "shamiyana:probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export class PlanStore {
  private snapshot: Snapshot = SERVER_SNAPSHOT;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly storage: () => Storage | null) {}

  subscribe = (listener: () => void): (() => void) => {
    if (this.listeners.size === 0) {
      this.load();
      window.addEventListener("storage", this.onStorage);
    }
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) window.removeEventListener("storage", this.onStorage);
    };
  };

  getSnapshot = (): Snapshot => this.snapshot;

  getServerSnapshot = (): Snapshot => SERVER_SNAPSHOT;

  load(): void {
    const { data, notice } = readStore(this.storage());
    this.set({ ready: true, data, notice });
  }

  commit(data: Store): void {
    const notice = writeStore(this.storage(), data);
    this.set({ ready: true, data, notice });
  }

  dismissNotice(): void {
    this.set({ ...this.snapshot, notice: null });
  }

  private readonly onStorage = (event: StorageEvent): void => {
    if (event.key === STORE_KEY) this.load();
  };

  private set(next: Snapshot): void {
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}

export function activePlan(data: Store): PlanRecord | null {
  return data.plans.find((p) => p.id === data.activeId) ?? null;
}

/** Replaces the plan with the same id or adds it, and makes it active. */
export function putPlan(data: Store, record: PlanRecord): Store {
  const exists = data.plans.some((p) => p.id === record.id);
  const plans = exists
    ? data.plans.map((p) => (p.id === record.id ? record : p))
    : [...data.plans, record];
  return { ...data, activeId: record.id, plans };
}

export function canAddPlan(data: Store): boolean {
  return data.plans.length < LIMITS.plansMax;
}

export function removePlan(data: Store, id: string): Store {
  const plans = data.plans.filter((p) => p.id !== id);
  const activeId = data.activeId === id ? (plans.at(-1)?.id ?? null) : data.activeId;
  return { ...data, plans, activeId };
}

export function selectPlan(data: Store, id: string | null): Store {
  return { ...data, activeId: id !== null && data.plans.some((p) => p.id === id) ? id : null };
}

let shared: PlanStore | null = null;

export function sharedStore(): PlanStore {
  shared ??= new PlanStore(browserStorage);
  return shared;
}

export type BackupResult = { ok: true; record: PlanRecord } | { ok: false; reason: "bad" | "full" };

/** A backup file's plan, if it is one and there is room for it; replacing a plan with the same id always fits. */
export function parseBackup(text: string | null, data: Store): BackupResult {
  let value: unknown;
  try {
    value = JSON.parse(text ?? "");
  } catch {
    return { ok: false, reason: "bad" };
  }
  const parsed = planRecordSchema.safeParse(value);
  if (!parsed.success) return { ok: false, reason: "bad" };
  const replaces = data.plans.some((p) => p.id === parsed.data.id);
  return replaces || canAddPlan(data)
    ? { ok: true, record: withCleanEnrichment(parsed.data) }
    : { ok: false, reason: "full" };
}

/** Saves a changed plan into the latest data; a plan deleted meanwhile stays deleted. */
export function savePlan(data: Store, record: PlanRecord): Store {
  return { ...data, plans: data.plans.map((p) => (p.id === record.id ? record : p)) };
}
