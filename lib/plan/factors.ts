import { LIMITS } from "./constants";

/** A budget line's weight kept inside its bounds, to two decimals. */
export function clampFactor(value: number): number {
  return Math.round(Math.min(LIMITS.factorMax, Math.max(LIMITS.factorMin, value)) * 100) / 100;
}
