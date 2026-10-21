/** An in-memory Storage that can be told to refuse writes, like a full or locked-down browser. */
export class MemoryStorage implements Storage {
  private readonly items = new Map<string, string>();
  failWrites = false;

  get length(): number {
    return this.items.size;
  }

  clear(): void {
    this.items.clear();
  }

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new DOMException("full", "QuotaExceededError");
    this.items.set(key, value);
  }
}
