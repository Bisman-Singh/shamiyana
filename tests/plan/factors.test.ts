import { LIMITS } from "@/lib/plan/constants";
import { clampFactor, nudge } from "@/lib/plan/factors";

describe("clampFactor", () => {
  it("keeps a weight inside its bounds, to two decimals", () => {
    expect(clampFactor(1.234)).toBeCloseTo(1.23, 10);
    expect(clampFactor(9)).toBe(LIMITS.factorMax);
    expect(clampFactor(0)).toBe(LIMITS.factorMin);
  });
});

describe("nudge", () => {
  it("keeps weights inside 0.5 and 1.5", () => {
    expect(nudge(1.5, 1)).toBe(1.5);
    expect(nudge(0.5, -1)).toBe(0.5);
    expect(nudge(1, -1)).toBeCloseTo(0.9, 10);
  });
});
