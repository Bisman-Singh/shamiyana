import "server-only";

/** A second bound on a BoundedMap: the total weight of its values, such as their length. */
export interface WeightLimit<V> {
  max: number;
  weigh: (value: V) => number;
}

const UNWEIGHED: WeightLimit<unknown> = { max: Infinity, weigh: () => 0 };

/**
 * A Map that keeps at most `maxKeys` entries and, given a weight limit, at
 * most that much total weight. Writing a key makes it the newest; past either
 * limit the oldest written keys are dropped, so a flood of spoofed client keys
 * or long answers cannot grow memory without bound.
 */
export class BoundedMap<K, V> {
  private readonly entries = new Map<K, { value: V; weight: number }>();
  private totalWeight = 0;

  constructor(
    private readonly maxKeys: number,
    private readonly weightLimit: WeightLimit<V> = UNWEIGHED,
  ) {}

  get(key: K): V | undefined {
    return this.entries.get(key)?.value;
  }

  /** Stores the value as the newest entry and drops the oldest ones past the limits. */
  set(key: K, value: V): void {
    this.delete(key);
    const weight = this.weightLimit.weigh(value);
    this.entries.set(key, { value, weight });
    this.totalWeight += weight;
    for (const [oldestKey, oldest] of this.entries) {
      if (this.entries.size <= this.maxKeys && this.totalWeight <= this.weightLimit.max) break;
      this.entries.delete(oldestKey);
      this.totalWeight -= oldest.weight;
    }
  }

  delete(key: K): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key);
    this.totalWeight -= entry.weight;
  }

  clear(): void {
    this.entries.clear();
    this.totalWeight = 0;
  }

  get size(): number {
    return this.entries.size;
  }
}
