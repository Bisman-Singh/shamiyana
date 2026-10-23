import "server-only";

/**
 * A Map that keeps at most `maxKeys` entries. Writing a key makes it the
 * newest; past the limit the oldest written keys are dropped, so a flood of
 * spoofed client keys cannot grow memory without bound.
 */
export class BoundedMap<K, V> {
  private readonly entries = new Map<K, V>();

  constructor(private readonly maxKeys: number) {}

  get(key: K): V | undefined {
    return this.entries.get(key);
  }

  /** Stores the value as the newest entry and drops the oldest ones past the limit. */
  set(key: K, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    for (const oldest of this.entries.keys()) {
      if (this.entries.size <= this.maxKeys) break;
      this.entries.delete(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
