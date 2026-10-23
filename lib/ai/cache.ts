import "server-only";

/**
 * A small LRU cache with expiry for finished AI answers. The same brief asked
 * twice gets the first answer back at once and costs nothing; "new ideas"
 * skips it. Bounded by entry count and total characters.
 */
export class AnswerCache {
  private readonly entries = new Map<string, { value: string; expires: number }>();
  private chars = 0;

  constructor(
    private readonly maxEntries = 200,
    private readonly maxChars = 2_000_000,
    private readonly ttlMs = 6 * 60 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): string | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    this.entries.delete(key);
    if (entry.expires <= this.now()) {
      this.chars -= entry.value.length;
      return null;
    }
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: string): void {
    if (value.length > this.maxChars) return;
    const old = this.entries.get(key);
    if (old) {
      this.chars -= old.value.length;
      this.entries.delete(key);
    }
    this.entries.set(key, { value, expires: this.now() + this.ttlMs });
    this.chars += value.length;
    for (const [oldestKey, oldest] of this.entries) {
      if (this.entries.size <= this.maxEntries && this.chars <= this.maxChars) break;
      this.entries.delete(oldestKey);
      this.chars -= oldest.value.length;
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

/** A SHA-256 key for an answer, from everything that shapes it. */
export async function cacheKey(parts: unknown): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(parts));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
