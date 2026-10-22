import { z } from "zod";
import { clampFactor } from "./factors";
import {
  CATEGORY_IDS,
  IDEA_AREAS,
  IDEA_COSTS,
  LIMITS,
  TASK_AREAS,
  type CategoryId,
} from "./constants";
import { clamp, finite, isRecord, oneOf, records, texts, uniqueBy } from "./loose";
import { clip } from "./text";

/**
 * The AI enrichment as a plan stores it: every list and string bounded, every
 * number in range. Model output never reaches storage or the screen without
 * passing through `sanitizeEnrichment` first.
 */

const ENRICHMENT_LIMITS = {
  ideas: 8,
  menu: 6,
  dishes: 8,
  shifts: 6,
  tasks: 6,
  questions: 8,
  questionItems: 4,
  risks: 4,
  themeName: 60,
  themeSummary: 300,
  course: 40,
  dish: 60,
  reason: 200,
  question: 160,
  risk: 160,
  mitigation: 200,
} as const;

const L = ENRICHMENT_LIMITS;
const s = (max: number) => z.string().max(max);

export const enrichmentSchema = z.strictObject({
  theme: z.strictObject({ name: s(L.themeName), summary: s(L.themeSummary) }),
  ideas: z
    .array(
      z.strictObject({
        area: z.enum(IDEA_AREAS),
        title: s(LIMITS.ideaTitleMax),
        detail: s(LIMITS.ideaDetailMax),
        cost: z.enum(IDEA_COSTS),
      }),
    )
    .max(L.ideas),
  menu: z
    .array(z.strictObject({ course: s(L.course), dishes: z.array(s(L.dish)).max(L.dishes) }))
    .max(L.menu),
  shifts: z
    .array(
      z.strictObject({
        category: z.enum(CATEGORY_IDS),
        factor: z.number().min(LIMITS.factorMin).max(LIMITS.factorMax),
        reason: s(L.reason),
      }),
    )
    .max(L.shifts),
  tasks: z
    .array(
      z.strictObject({
        title: s(LIMITS.taskTitleMax),
        area: z.enum(TASK_AREAS),
        weeksBefore: z.int().min(0).max(LIMITS.weeksMax),
      }),
    )
    .max(L.tasks),
  questions: z
    .array(
      z.strictObject({
        category: z.enum(CATEGORY_IDS),
        items: z.array(s(L.question)).max(L.questionItems),
      }),
    )
    .max(L.questions),
  risks: z.array(z.strictObject({ risk: s(L.risk), mitigation: s(L.mitigation) })).max(L.risks),
});
export type Enrichment = z.infer<typeof enrichmentSchema>;

function ideas(raw: unknown): Enrichment["ideas"] {
  const all = records(raw)
    .map((item) => ({
      area: oneOf(item.area, IDEA_AREAS) ?? "theme",
      title: clip(item.title, LIMITS.ideaTitleMax),
      detail: clip(item.detail, LIMITS.ideaDetailMax),
      cost: oneOf(item.cost, IDEA_COSTS) ?? "medium",
    }))
    .filter((idea) => idea.title !== "");
  return uniqueBy(all, (idea) => idea.title).slice(0, L.ideas);
}

function menu(raw: unknown): Enrichment["menu"] {
  const all = records(raw)
    .map((item) => ({
      course: clip(item.course, L.course),
      dishes: texts(item.dishes, L.dish, L.dishes),
    }))
    .filter((course) => course.course !== "" && course.dishes.length > 0);
  return uniqueBy(all, (course) => course.course).slice(0, L.menu);
}

function shifts(raw: unknown, allowed: ReadonlySet<CategoryId>): Enrichment["shifts"] {
  const seen = new Set<CategoryId>();
  const out: Enrichment["shifts"] = [];
  for (const item of records(raw)) {
    const category = oneOf(item.category, CATEGORY_IDS);
    const value = finite(item.factor);
    if (!category || value === null || !allowed.has(category) || seen.has(category)) continue;
    const factor = clampFactor(value);
    if (category === "contingency" || factor === 1) continue;
    seen.add(category);
    out.push({ category, factor, reason: clip(item.reason, L.reason) });
  }
  return out.slice(0, L.shifts);
}

function tasks(raw: unknown): Enrichment["tasks"] {
  const all = records(raw)
    .map((item) => ({
      title: clip(item.title, LIMITS.taskTitleMax),
      area: oneOf(item.area, TASK_AREAS) ?? "planning",
      weeksBefore: Math.round(clamp(item.weeksBefore, 0, LIMITS.weeksMax) ?? 0),
    }))
    .filter((task) => task.title !== "");
  return uniqueBy(all, (task) => task.title).slice(0, L.tasks);
}

function questions(raw: unknown): Enrichment["questions"] {
  const all = records(raw)
    .map((item) => ({
      category: oneOf(item.category, CATEGORY_IDS),
      items: texts(item.items, L.question, L.questionItems),
    }))
    .filter(
      (group): group is Enrichment["questions"][number] =>
        group.category !== null && group.items.length > 0,
    );
  return uniqueBy(all, (group) => group.category).slice(0, L.questions);
}

function risks(raw: unknown): Enrichment["risks"] {
  const all = records(raw)
    .map((item) => ({
      risk: clip(item.risk, L.risk),
      mitigation: clip(item.mitigation, L.mitigation),
    }))
    .filter((r) => r.risk !== "" && r.mitigation !== "");
  return uniqueBy(all, (r) => r.risk).slice(0, L.risks);
}

/**
 * Turns whatever the model produced, complete or partial, into a valid
 * `Enrichment`: unknown fields dropped, strings cut, numbers clamped, budget
 * shifts kept only for categories this plan actually has.
 */
export function sanitizeEnrichment(raw: unknown, categories: readonly CategoryId[]): Enrichment {
  const value = isRecord(raw) ? raw : {};
  const theme = isRecord(value.theme) ? value.theme : {};
  return {
    theme: { name: clip(theme.name, L.themeName), summary: clip(theme.summary, L.themeSummary) },
    ideas: ideas(value.ideas),
    menu: menu(value.menu),
    shifts: shifts(value.shifts, new Set(categories)),
    tasks: tasks(value.tasks),
    questions: questions(value.questions),
    risks: risks(value.risks),
  };
}

/** AI tasks moved no earlier than today, so none is overdue the moment it arrives. */
export function fitTasks(e: Enrichment, weeksLeft: number): Enrichment {
  return {
    ...e,
    tasks: e.tasks.map((t) => ({ ...t, weeksBefore: Math.min(t.weeksBefore, weeksLeft) })),
  };
}

export function isEmptyEnrichment(e: Enrichment): boolean {
  return (
    e.theme.name === "" &&
    e.ideas.length === 0 &&
    e.menu.length === 0 &&
    e.shifts.length === 0 &&
    e.tasks.length === 0 &&
    e.questions.length === 0 &&
    e.risks.length === 0
  );
}
