import {
  CATEGORY_IDS,
  IDEA_AREAS,
  LIMITS,
  type CategoryId,
  type IdeaArea,
  type TaskArea,
} from "./constants";
import { daysBetween, isIsoDate } from "./dates";
import { ENRICHMENT_LIMITS } from "./enrichment";
import { clip } from "./text";

/**
 * A change the refine assistant proposes. The model only proposes; nothing
 * is applied until the user approves it, and every change is re-checked here
 * against the same bounds the form uses.
 */
export type Change =
  | { op: "set_budget"; amount: number }
  | { op: "set_guests"; count: number }
  | { op: "set_date"; date: string }
  | { op: "shift_category"; category: CategoryId; factor: number }
  | { op: "add_task"; title: string; area: TaskArea; weeksBefore: number }
  | { op: "add_idea"; area: IdeaArea; title: string; detail: string };

export const CHANGE_OPS = [
  "set_budget",
  "set_guests",
  "set_date",
  "shift_category",
  "add_task",
  "add_idea",
] as const;

export const MAX_CHANGES = 6;

type Loose = Record<string, unknown>;

function int(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const n = Math.round(value);
  return n >= min && n <= max ? n : null;
}

function within<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return allowed.find((a) => a === value) ?? null;
}

const AREAS = [...CATEGORY_IDS, "planning"] as const;

function budget(item: Loose): Change | null {
  const amount = int(item.amount, LIMITS.budgetMin, LIMITS.budgetMax);
  return amount === null ? null : { op: "set_budget", amount };
}

function guests(item: Loose): Change | null {
  const count = int(item.count, LIMITS.guestsMin, LIMITS.guestsMax);
  return count === null ? null : { op: "set_guests", count };
}

function date(item: Loose, today: string): Change | null {
  if (typeof item.date !== "string" || !isIsoDate(item.date)) return null;
  const ahead = daysBetween(today, item.date);
  return ahead >= 0 && ahead <= LIMITS.maxDaysAhead ? { op: "set_date", date: item.date } : null;
}

function shift(item: Loose, categories: ReadonlySet<CategoryId>): Change | null {
  const category = within(item.category, CATEGORY_IDS);
  const factor = item.factor;
  if (!category || !categories.has(category) || category === "contingency") return null;
  if (typeof factor !== "number" || !Number.isFinite(factor)) return null;
  const bounded = Math.min(
    ENRICHMENT_LIMITS.factorMax,
    Math.max(ENRICHMENT_LIMITS.factorMin, factor),
  );
  return { op: "shift_category", category, factor: Math.round(bounded * 100) / 100 };
}

function task(item: Loose): Change | null {
  const title = clip(item.title, 120);
  const weeksBefore = int(item.weeksBefore, 0, ENRICHMENT_LIMITS.weeksMax);
  if (title === "" || weeksBefore === null) return null;
  return { op: "add_task", title, area: within(item.area, AREAS) ?? "planning", weeksBefore };
}

function idea(item: Loose): Change | null {
  const title = clip(item.title, 80);
  if (title === "") return null;
  return {
    op: "add_idea",
    area: within(item.area, IDEA_AREAS) ?? "theme",
    title,
    detail: clip(item.detail, 300),
  };
}

interface Context {
  categories: ReadonlySet<CategoryId>;
  today: string;
}

const PARSERS: Record<(typeof CHANGE_OPS)[number], (item: Loose, ctx: Context) => Change | null> = {
  set_budget: budget,
  set_guests: guests,
  set_date: (item, ctx) => date(item, ctx.today),
  shift_category: (item, ctx) => shift(item, ctx.categories),
  add_task: task,
  add_idea: idea,
};

/** The key that makes a change a duplicate: one budget, guest count or date, one shift per category. */
function singleKey(change: Change): string | null {
  if (change.op === "add_task" || change.op === "add_idea") return null;
  return change.op === "shift_category" ? `shift:${change.category}` : change.op;
}

/** Keeps only well-formed, in-bounds changes, without duplicates, at most `MAX_CHANGES`. */
export function parseChanges(
  raw: unknown,
  categories: readonly CategoryId[],
  today: string,
): Change[] {
  if (!Array.isArray(raw)) return [];
  const ctx: Context = { categories: new Set(categories), today };
  const seen = new Set<string>();
  const out: Change[] = [];
  for (const entry of raw as unknown[]) {
    if (typeof entry !== "object" || entry === null) continue;
    const item = entry as Loose;
    const op = within(item.op, CHANGE_OPS);
    const change = op ? PARSERS[op](item, ctx) : null;
    if (!change) continue;
    const key = singleKey(change);
    if (key !== null && seen.has(key)) continue;
    if (key !== null) seen.add(key);
    out.push(change);
    if (out.length === MAX_CHANGES) break;
  }
  return out;
}
