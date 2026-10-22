import { clampFactor } from "./factors";
import {
  CATEGORY_IDS,
  IDEA_AREAS,
  LIMITS,
  TASK_AREAS,
  type CategoryId,
  type IdeaArea,
  type TaskArea,
} from "./constants";
import { daysBetween, isIsoDate } from "./dates";
import { finite, int, oneOf, records, type Loose } from "./loose";
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
  const category = oneOf(item.category, CATEGORY_IDS);
  const factor = finite(item.factor);
  if (!category || !categories.has(category) || category === "contingency") return null;
  if (factor === null) return null;
  return { op: "shift_category", category, factor: clampFactor(factor) };
}

function task(item: Loose): Change | null {
  const title = clip(item.title, LIMITS.taskTitleMax);
  const weeksBefore = int(item.weeksBefore, 0, LIMITS.weeksMax);
  if (title === "" || weeksBefore === null) return null;
  return { op: "add_task", title, area: oneOf(item.area, TASK_AREAS) ?? "planning", weeksBefore };
}

function idea(item: Loose): Change | null {
  const title = clip(item.title, LIMITS.ideaTitleMax);
  if (title === "") return null;
  return {
    op: "add_idea",
    area: oneOf(item.area, IDEA_AREAS) ?? "theme",
    title,
    detail: clip(item.detail, LIMITS.ideaDetailMax),
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

/** Added tasks moved no earlier than today, so none is overdue the moment it is approved. */
export function fitChanges(changes: readonly Change[], weeksLeft: number): Change[] {
  return changes.map((c) =>
    c.op === "add_task" ? { ...c, weeksBefore: Math.min(c.weeksBefore, weeksLeft) } : c,
  );
}

/** Keeps only well-formed, in-bounds changes, without duplicates, at most `MAX_CHANGES`. */
export function parseChanges(
  raw: unknown,
  categories: readonly CategoryId[],
  today: string,
): Change[] {
  const ctx: Context = { categories: new Set(categories), today };
  const seen = new Set<string>();
  const out: Change[] = [];
  for (const item of records(raw)) {
    const op = oneOf(item.op, CHANGE_OPS);
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
