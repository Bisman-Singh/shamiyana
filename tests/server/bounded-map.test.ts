import { BoundedMap } from "@/lib/server/bounded-map";

describe("BoundedMap", () => {
  it("drops the oldest written keys past its limit", () => {
    const map = new BoundedMap<string, number>(2);
    map.set("a", 1);
    map.set("b", 2);
    map.set("c", 3);
    expect(map.size).toBe(2);
    expect(map.get("a")).toBeUndefined();
    expect(map.get("c")).toBe(3);
  });

  it("treats a rewritten key as the newest", () => {
    const map = new BoundedMap<string, number>(2);
    const writes: [string, number][] = [
      ["a", 1],
      ["b", 2],
      ["a", 10],
      ["c", 3],
    ];
    for (const [key, value] of writes) map.set(key, value);
    expect(map.get("a")).toBe(10);
    expect(map.get("b")).toBeUndefined();
    map.clear();
    expect(map.size).toBe(0);
  });
});
