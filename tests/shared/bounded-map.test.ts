import { BoundedMap } from "@/lib/shared/bounded-map";

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

  it("also drops the oldest keys past a total weight, and forgets a deleted key's weight", () => {
    const map = new BoundedMap<string, string>(10, { max: 5, weigh: (value) => value.length });
    map.set("a", "xx");
    map.set("b", "xxx");
    map.set("c", "x");
    expect(map.get("a")).toBeUndefined();
    expect(map.size).toBe(2);
    map.delete("b");
    map.set("d", "xxxx");
    expect(map.get("c")).toBe("x");
    expect(map.size).toBe(2);
  });
});
