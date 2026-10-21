import { z } from "zod";
import { CATEGORY_IDS, IDEA_AREAS, type CategoryId } from "./constants";
import { clip } from "./text";

/**
 * The AI enrichment as a plan stores it: every list and string bounded, every
 * number in range. Model output never reaches storage or the screen without
 * passing through `sanitizeEnrichment` first.
 */

export const ENRICHMENT_LIMITS = {
  ideas: 8,
  menu: 6,
  dishes: 8,
  shifts: 6,
  tasks: 6,
  questions: 8,
  questionItems: 4,
  risks: 4,
  factorMin: 0.5,
  factorMax: 1.5,
  weeksMax: 52,
} as const;

const s = (max: number) => z.string().max(max);
const taskArea = z.enum([...CATEGORY_IDS, "planning"]);

export const enrichmentSchema = z.strictObject({
  theme: z.strictObject({ name: s(60), summary: s(300) }),
  ideas: z
    .array(
      z.strictObject({
        area: z.enum(IDEA_AREAS),
        title: s(80),
        detail: s(300),
        cost: z.enum(["low", "medium", "high"]),
      }),
    )
    .max(ENRICHMENT_LIMITS.ideas),
  menu: z
    .array(z.strictObject({ course: s(40), dishes: z.array(s(60)).max(ENRICHMENT_LIMITS.dishes) }))
    .max(ENRICHMENT_LIMITS.menu),
  shifts: z
    .array(
      z.strictObject({
        category: z.enum(CATEGORY_IDS),
        factor: z.number().min(ENRICHMENT_LIMITS.factorMin).max(ENRICHMENT_LIMITS.factorMax),
        reason: s(200),
      }),
    )
    .max(ENRICHMENT_LIMITS.shifts),
  tasks: z
    .array(
      z.strictObject({
        title: s(120),
        area: taskArea,
        weeksBefore: z.int().min(0).max(ENRICHMENT_LIMITS.weeksMax),
      }),
    )
    .max(ENRICHMENT_LIMITS.tasks),
  questions: z
    .array(
      z.strictObject({
        category: z.enum(CATEGORY_IDS),
        items: z.array(s(160)).max(ENRICHMENT_LIMITS.questionItems),
      }),
    )
    .max(ENRICHMENT_LIMITS.questions),
  risks: z.array(z.strictObject({ risk: s(160), mitigation: s(200) })).max(ENRICHMENT_LIMITS.risks),
});
export type Enrichment = z.infer<typeof enrichmentSchema>;

type Loose = Record<string, unknown>;

function isRecord(value: unknown): value is Loose {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function list(value: unknown): Loose[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function clamp(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(max, Math.max(min, value));
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return allowed.find((option) => option === value) ?? null;
}

const COSTS = ["low", "medium", "high"] as const;
const AREAS = [...CATEGORY_IDS, "planning"] as const;

function ideas(raw: unknown): Enrichment["ideas"] {
  return list(raw)
    .map((item) => ({
      area: oneOf(item.area, IDEA_AREAS) ?? "theme",
      title: clip(item.title, 80),
      detail: clip(item.detail, 300),
      cost: oneOf(item.cost, COSTS) ?? "medium",
    }))
    .filter((idea) => idea.title !== "")
    .slice(0, ENRICHMENT_LIMITS.ideas);
}

function menu(raw: unknown): Enrichment["menu"] {
  return list(raw)
    .map((item) => ({
      course: clip(item.course, 40),
      dishes: (Array.isArray(item.dishes) ? item.dishes : [])
        .map((dish) => clip(dish, 60))
        .filter((dish) => dish !== "")
        .slice(0, ENRICHMENT_LIMITS.dishes),
    }))
    .filter((course) => course.course !== "" && course.dishes.length > 0)
    .slice(0, ENRICHMENT_LIMITS.menu);
}

function shifts(raw: unknown, allowed: ReadonlySet<CategoryId>): Enrichment["shifts"] {
  const seen = new Set<CategoryId>();
  const out: Enrichment["shifts"] = [];
  for (const item of list(raw)) {
    const category = oneOf(item.category, CATEGORY_IDS);
    const factor = clamp(item.factor, ENRICHMENT_LIMITS.factorMin, ENRICHMENT_LIMITS.factorMax);
    if (!category || factor === null || !allowed.has(category) || seen.has(category)) continue;
    if (category === "contingency" || factor === 1) continue;
    seen.add(category);
    out.push({ category, factor: Math.round(factor * 100) / 100, reason: clip(item.reason, 200) });
  }
  return out.slice(0, ENRICHMENT_LIMITS.shifts);
}

function tasks(raw: unknown): Enrichment["tasks"] {
  return list(raw)
    .map((item) => ({
      title: clip(item.title, 120),
      area: oneOf(item.area, AREAS) ?? "planning",
      weeksBefore: Math.round(clamp(item.weeksBefore, 0, ENRICHMENT_LIMITS.weeksMax) ?? 0),
    }))
    .filter((task) => task.title !== "")
    .slice(0, ENRICHMENT_LIMITS.tasks);
}

function questions(raw: unknown): Enrichment["questions"] {
  return list(raw)
    .map((item) => ({
      category: oneOf(item.category, CATEGORY_IDS),
      items: (Array.isArray(item.items) ? item.items : [])
        .map((q) => clip(q, 160))
        .filter((q) => q !== "")
        .slice(0, ENRICHMENT_LIMITS.questionItems),
    }))
    .filter(
      (group): group is Enrichment["questions"][number] =>
        group.category !== null && group.items.length > 0,
    )
    .slice(0, ENRICHMENT_LIMITS.questions);
}

function risks(raw: unknown): Enrichment["risks"] {
  return list(raw)
    .map((item) => ({ risk: clip(item.risk, 160), mitigation: clip(item.mitigation, 200) }))
    .filter((r) => r.risk !== "" && r.mitigation !== "")
    .slice(0, ENRICHMENT_LIMITS.risks);
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
    theme: { name: clip(theme.name, 60), summary: clip(theme.summary, 300) },
    ideas: ideas(value.ideas),
    menu: menu(value.menu),
    shifts: shifts(value.shifts, new Set(categories)),
    tasks: tasks(value.tasks),
    questions: questions(value.questions),
    risks: risks(value.risks),
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
