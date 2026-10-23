import { clip } from "./text";

/**
 * Readers for untrusted values: model output, imported files, request
 * fields. Each returns a safe default instead of throwing, so one bad field
 * never costs the rest of the answer.
 */

export type Loose = Record<string, unknown>;

/** A plain object: not null and not an array. */
export function isRecord(value: unknown): value is Loose {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The plain objects in a list, or none when it isn't a list. */
export function records(value: unknown): Loose[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/**
 * The first of each item by `key`, compared without case. Lists rendered from
 * model text are keyed by that text, so a repeated line must not get through.
 */
export function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const k = key(item).toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Up to `count` distinct non-empty single lines from a list, each clipped to `max`. */
export function texts(value: unknown, max: number, count: number): string[] {
  const lines = (Array.isArray(value) ? value : [])
    .map((item) => clip(item, max))
    .filter((text) => text !== "");
  return uniqueBy(lines, (text) => text).slice(0, count);
}

/** The value when it is one of the allowed strings, else null. */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return allowed.find((option) => option === value) ?? null;
}

/** The value when it is a finite number, else null. */
export function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** A finite number pulled into range, or null. */
export function clamp(value: unknown, min: number, max: number): number | null {
  const n = finite(value);
  return n === null ? null : Math.min(max, Math.max(min, n));
}

/** A finite number that rounds to a whole number in range, or null. */
export function int(value: unknown, min: number, max: number): number | null {
  const n = finite(value);
  if (n === null) return null;
  const whole = Math.round(n);
  return whole >= min && whole <= max ? whole : null;
}

/** The object a JSON text holds at its top level, or an empty one. */
export function parseObject(text: string): Loose {
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : {};
  } catch {
    return {};
  }
}
