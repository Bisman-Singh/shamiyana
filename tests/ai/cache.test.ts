import { AnswerCache, cacheKey } from "@/lib/ai/cache";

describe("AnswerCache", () => {
  it("returns fresh entries, expires old ones and evicts the least recently used", () => {
    let now = 0;
    const cache = new AnswerCache({ maxEntries: 2, maxChars: 1_000, ttlMs: 100, now: () => now });
    cache.set("a", "1");
    cache.set("b", "2");
    expect(cache.get("a")).toBe("1");
    cache.set("c", "3");
    expect(cache.get("b")).toBeNull();
    expect(cache.size).toBe(2);
    now = 200;
    expect(cache.get("a")).toBeNull();
    expect(cache.get("missing")).toBeNull();
  });

  it("bounds total size and ignores a single oversized answer", () => {
    const cache = new AnswerCache({ maxEntries: 10, maxChars: 10 });
    cache.set("big", "x".repeat(11));
    expect(cache.size).toBe(0);
    cache.set("a", "xxxxxx");
    expect(cache.size).toBe(1);
    cache.set("a", "yyyyyy");
    expect(cache.size).toBe(1);
    cache.set("b", "xxxxxx");
    expect(cache.get("a")).toBeNull();
    expect(cache.get("b")).toBe("xxxxxx");
  });

  it("keys by content", async () => {
    expect(await cacheKey(["v", 1])).toBe(await cacheKey(["v", 1]));
    expect(await cacheKey(["v", 1])).toMatch(/^[0-9a-f]{64}$/);
    expect(await cacheKey(["v", 2])).not.toBe(await cacheKey(["v", 1]));
  });
});
