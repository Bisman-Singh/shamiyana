import { LIMITS } from "./constants";

/** A budget line's weight kept inside its bounds, to two decimals. */
export function clampFactor(value: number): number {
  return Math.round(Math.min(LIMITS.factorMax, Math.max(LIMITS.factorMin, value)) * 100) / 100;
}

/** The step a budget line's weight moves by. */
const FACTOR_STEP = 0.1;

/** One step up or down on a category's weight, on the 0.1 grid and inside its bounds. */
export function nudge(current: number, direction: 1 | -1): number {
  return clampFactor(Math.round((current + direction * FACTOR_STEP) * 10) / 10);
}
