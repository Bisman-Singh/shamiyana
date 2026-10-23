import { LIMITS } from "@/lib/plan/constants";
import { clampFactor } from "@/lib/plan/factors";

describe("clampFactor", () => {
  it("keeps a weight inside its bounds, to two decimals", () => {
    expect(clampFactor(1.234)).toBeCloseTo(1.23, 10);
    expect(clampFactor(9)).toBe(LIMITS.factorMax);
    expect(clampFactor(0)).toBe(LIMITS.factorMin);
  });
});
