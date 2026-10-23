import { EMPTY_STORE } from "@/lib/plan/plans";
import { storeSchema, type Store } from "@/lib/plan/schema";

/**
 * Plans live in localStorage under one versioned key, validated on every
 * read. Data that fails validation is moved aside, never silently deleted,
 * and the app starts clean. Other tabs pick up changes through the storage
 * event. The store is a tiny external store for `useSyncExternalStore`.
 */

export const STORE_KEY = "shamiyana:v1";
export const QUARANTINE_KEY = "shamiyana:unreadable";

/** Why saved plans could not be read or written as usual. */
export type StorageIssue = "blocked" | "full" | "recovered";

export interface Snapshot {
  ready: boolean;
  data: Store;
  notice: StorageIssue | null;
}

const SERVER_SNAPSHOT: Snapshot = { ready: false, data: EMPTY_STORE, notice: null };

/** Reads saved plans; anything unreadable is set aside, not lost. */
export function readStore(storage: Storage | null): { data: Store; notice: StorageIssue | null } {
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

/** Saves plans and reports when the browser refuses. */
export function writeStore(storage: Storage | null, data: Store): StorageIssue | null {
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

/** The saved plans as an external store for useSyncExternalStore. */
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

  /** The saved data that was set aside because it couldn't be read, while it is still kept. */
  readUnreadable(): string | null {
    return this.storage()?.getItem(QUARANTINE_KEY) ?? null;
  }

  /** Deletes the set-aside copy for good, and the notice about it. */
  deleteUnreadable(): void {
    this.storage()?.removeItem(QUARANTINE_KEY);
    this.dismissNotice();
  }

  private readonly onStorage = (event: StorageEvent): void => {
    if (event.key === STORE_KEY) this.load();
  };

  private set(next: Snapshot): void {
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }
}

let shared: PlanStore | null = null;

/** The one store this browser tab uses. */
export function sharedStore(): PlanStore {
  shared ??= new PlanStore(browserStorage);
  return shared;
}
