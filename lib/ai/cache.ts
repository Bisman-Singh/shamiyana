import "server-only";
import { BoundedMap } from "@/lib/server/bounded-map";

export interface AnswerCacheOptions {
  maxEntries?: number;
  /** Total characters across every cached answer. */
  maxChars?: number;
  ttlMs?: number;
  now?: () => number;
}

interface CachedAnswer {
  value: string;
  expires: number;
}

/**
 * A small LRU cache with expiry for finished AI answers. The same brief asked
 * twice gets the first answer back at once and costs nothing; "new ideas"
 * skips it. Bounded by entry count and total characters.
 */
export class AnswerCache {
  private readonly entries: BoundedMap<string, CachedAnswer>;
  private readonly maxChars: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options: AnswerCacheOptions = {}) {
    this.maxChars = options.maxChars ?? 2_000_000;
    this.ttlMs = options.ttlMs ?? 6 * 60 * 60 * 1000;
    this.now = options.now ?? Date.now;
    this.entries = new BoundedMap(options.maxEntries ?? 200, {
      max: this.maxChars,
      weigh: (answer) => answer.value.length,
    });
  }

  /** A fresh answer, which also becomes the most recently used; an expired one is dropped. */
  get(key: string): string | null {
    const answer = this.entries.get(key);
    if (!answer) return null;
    if (answer.expires <= this.now()) {
      this.entries.delete(key);
      return null;
    }
    this.entries.set(key, answer);
    return answer.value;
  }

  /** Keeps an answer as the newest; one longer than the whole budget is not kept at all. */
  set(key: string, value: string): void {
    if (value.length > this.maxChars) return;
    this.entries.set(key, { value, expires: this.now() + this.ttlMs });
  }

  get size(): number {
    return this.entries.size;
  }
}

/** A SHA-256 key for an answer, from everything that shapes it. */
export async function cacheKey(parts: unknown): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(parts));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
