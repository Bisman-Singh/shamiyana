import { z } from "zod";
import { clip } from "@/lib/shared/plain-text";
import { clamp, finite, isRecord, oneOf, records, texts, uniqueBy } from "@/lib/shared/untrusted";
import {
  CATEGORY_IDS,
  IDEA_AREAS,
  IDEA_COSTS,
  LIMITS,
  TASK_AREAS,
  type CategoryId,
} from "./constants";
import { clampFactor } from "./factors";

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

/** A model-written string the schema caps at this many characters. */
const boundedText = (max: number) => z.string().max(max);

export const enrichmentSchema = z.strictObject({
  theme: z.strictObject({
    name: boundedText(ENRICHMENT_LIMITS.themeName),
    summary: boundedText(ENRICHMENT_LIMITS.themeSummary),
  }),
  ideas: z
    .array(
      z.strictObject({
        area: z.enum(IDEA_AREAS),
        title: boundedText(LIMITS.ideaTitleMax),
        detail: boundedText(LIMITS.ideaDetailMax),
        cost: z.enum(IDEA_COSTS),
      }),
    )
    .max(ENRICHMENT_LIMITS.ideas),
  menu: z
    .array(
      z.strictObject({
        course: boundedText(ENRICHMENT_LIMITS.course),
        dishes: z.array(boundedText(ENRICHMENT_LIMITS.dish)).max(ENRICHMENT_LIMITS.dishes),
      }),
    )
    .max(ENRICHMENT_LIMITS.menu),
  shifts: z
    .array(
      z.strictObject({
        category: z.enum(CATEGORY_IDS),
        factor: z.number().min(LIMITS.factorMin).max(LIMITS.factorMax),
        reason: boundedText(ENRICHMENT_LIMITS.reason),
      }),
    )
    .max(ENRICHMENT_LIMITS.shifts),
  tasks: z
    .array(
      z.strictObject({
        title: boundedText(LIMITS.taskTitleMax),
        area: z.enum(TASK_AREAS),
        weeksBefore: z.int().min(0).max(LIMITS.weeksMax),
      }),
    )
    .max(ENRICHMENT_LIMITS.tasks),
  questions: z
    .array(
      z.strictObject({
        category: z.enum(CATEGORY_IDS),
        items: z
          .array(boundedText(ENRICHMENT_LIMITS.question))
          .max(ENRICHMENT_LIMITS.questionItems),
      }),
    )
    .max(ENRICHMENT_LIMITS.questions),
  risks: z
    .array(
      z.strictObject({
        risk: boundedText(ENRICHMENT_LIMITS.risk),
        mitigation: boundedText(ENRICHMENT_LIMITS.mitigation),
      }),
    )
    .max(ENRICHMENT_LIMITS.risks),
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
  return uniqueBy(all, (idea) => idea.title).slice(0, ENRICHMENT_LIMITS.ideas);
}

function menu(raw: unknown): Enrichment["menu"] {
  const all = records(raw)
    .map((item) => ({
      course: clip(item.course, ENRICHMENT_LIMITS.course),
      dishes: texts(item.dishes, ENRICHMENT_LIMITS.dish, ENRICHMENT_LIMITS.dishes),
    }))
    .filter((course) => course.course !== "" && course.dishes.length > 0);
  return uniqueBy(all, (course) => course.course).slice(0, ENRICHMENT_LIMITS.menu);
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
    out.push({ category, factor, reason: clip(item.reason, ENRICHMENT_LIMITS.reason) });
  }
  return out.slice(0, ENRICHMENT_LIMITS.shifts);
}

function tasks(raw: unknown): Enrichment["tasks"] {
  const all = records(raw)
    .map((item) => ({
      title: clip(item.title, LIMITS.taskTitleMax),
      area: oneOf(item.area, TASK_AREAS) ?? "planning",
      weeksBefore: Math.round(clamp(item.weeksBefore, 0, LIMITS.weeksMax) ?? 0),
    }))
    .filter((task) => task.title !== "");
  return uniqueBy(all, (task) => task.title).slice(0, ENRICHMENT_LIMITS.tasks);
}

function questions(raw: unknown): Enrichment["questions"] {
  const all = records(raw)
    .map((item) => ({
      category: oneOf(item.category, CATEGORY_IDS),
      items: texts(item.items, ENRICHMENT_LIMITS.question, ENRICHMENT_LIMITS.questionItems),
    }))
    .filter(
      (group): group is Enrichment["questions"][number] =>
        group.category !== null && group.items.length > 0,
    );
  return uniqueBy(all, (group) => group.category).slice(0, ENRICHMENT_LIMITS.questions);
}

function risks(raw: unknown): Enrichment["risks"] {
  const all = records(raw)
    .map((item) => ({
      risk: clip(item.risk, ENRICHMENT_LIMITS.risk),
      mitigation: clip(item.mitigation, ENRICHMENT_LIMITS.mitigation),
    }))
    .filter((item) => item.risk !== "" && item.mitigation !== "");
  return uniqueBy(all, (item) => item.risk).slice(0, ENRICHMENT_LIMITS.risks);
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
    theme: {
      name: clip(theme.name, ENRICHMENT_LIMITS.themeName),
      summary: clip(theme.summary, ENRICHMENT_LIMITS.themeSummary),
    },
    ideas: ideas(value.ideas),
    menu: menu(value.menu),
    shifts: shifts(value.shifts, new Set(categories)),
    tasks: tasks(value.tasks),
    questions: questions(value.questions),
    risks: risks(value.risks),
  };
}

/** AI tasks moved no earlier than today, so none is overdue the moment it arrives. */
export function fitTasks(enrichment: Enrichment, weeksLeft: number): Enrichment {
  return {
    ...enrichment,
    tasks: enrichment.tasks.map((task) => ({
      ...task,
      weeksBefore: Math.min(task.weeksBefore, weeksLeft),
    })),
  };
}

/** Whether an answer has nothing worth keeping. */
export function isEmptyEnrichment(enrichment: Enrichment): boolean {
  return (
    enrichment.theme.name === "" &&
    enrichment.ideas.length === 0 &&
    enrichment.menu.length === 0 &&
    enrichment.shifts.length === 0 &&
    enrichment.tasks.length === 0 &&
    enrichment.questions.length === 0 &&
    enrichment.risks.length === 0
  );
}
