import {
  clamp,
  finite,
  int,
  isRecord,
  oneOf,
  parseObject,
  records,
  texts,
  uniqueBy,
} from "@/lib/shared/untrusted";

describe("readers for untrusted values", () => {
  it("tells plain objects from arrays, null and other values", () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect([null, [], "x", 3].map(isRecord)).toEqual([false, false, false, false]);
    expect(records([{ a: 1 }, null, [], "x", { b: 2 }])).toEqual([{ a: 1 }, { b: 2 }]);
    expect(records("not a list")).toEqual([]);
  });

  it("keeps the first of each item, ignoring case", () => {
    expect(uniqueBy(["Dhol", "dhol", "Mehndi"], (s) => s)).toEqual(["Dhol", "Mehndi"]);
    expect(texts(["  Dhol ", "", "dhol", 5, "Mehndi", "Haldi"], 10, 2)).toEqual(["Dhol", "Mehndi"]);
    expect(texts("not a list", 10, 2)).toEqual([]);
  });

  it("accepts only allowed strings and finite numbers, and pulls numbers into range", () => {
    expect(oneOf("veg", ["veg", "jain"] as const)).toBe("veg");
    expect(oneOf("meat", ["veg", "jain"] as const)).toBeNull();
    expect([finite(2.5), finite(Number.NaN), finite("2")]).toEqual([2.5, null, null]);
    expect([clamp(9, 0, 5), clamp(-1, 0, 5), clamp("x", 0, 5)]).toEqual([5, 0, null]);
    expect([int(2.4, 1, 5), int(9, 1, 5), int(Number.POSITIVE_INFINITY, 1, 5)]).toEqual([
      2,
      null,
      null,
    ]);
  });

  it("reads a top-level JSON object, or nothing", () => {
    expect(parseObject('{"a":1}')).toEqual({ a: 1 });
    expect([parseObject("[1]"), parseObject("not json")]).toEqual([{}, {}]);
  });
});
