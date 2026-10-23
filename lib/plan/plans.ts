import { LIMITS } from "./constants";
import { withCleanEnrichment } from "./record";
import { planRecordSchema, type PlanRecord, type Store } from "./schema";

/**
 * The list of saved plans as pure edits from one store value to the next.
 * Where the store is kept, and how other tabs hear of it, is the client's
 * business (`lib/client/plan-store.ts`).
 */

/** No plans and none open. */
export const EMPTY_STORE: Store = { version: 1, activeId: null, plans: [] };

/** The plan that is open, if any. */
export function activePlan(data: Store): PlanRecord | null {
  return data.plans.find((plan) => plan.id === data.activeId) ?? null;
}

/** Replaces the plan with the same id or adds it, and makes it active. */
export function putPlan(data: Store, record: PlanRecord): Store {
  const exists = data.plans.some((plan) => plan.id === record.id);
  const plans = exists
    ? data.plans.map((plan) => (plan.id === record.id ? record : plan))
    : [...data.plans, record];
  return { ...data, activeId: record.id, plans };
}

/** Whether another plan fits under the limit. */
export function canAddPlan(data: Store): boolean {
  return data.plans.length < LIMITS.plansMax;
}

/** The store without a plan; if it was open, the last plan in the list opens instead. */
export function removePlan(data: Store, id: string): Store {
  const plans = data.plans.filter((plan) => plan.id !== id);
  const activeId = data.activeId === id ? (plans.at(-1)?.id ?? null) : data.activeId;
  return { ...data, plans, activeId };
}

/** Opens a plan by id, or none when the id is unknown. */
export function selectPlan(data: Store, id: string | null): Store {
  return {
    ...data,
    activeId: id !== null && data.plans.some((plan) => plan.id === id) ? id : null,
  };
}

export type BackupResult = { ok: true; record: PlanRecord } | { ok: false; reason: "bad" | "full" };

/** A backup file's plan, if it is one and there is room for it; replacing a plan with the same id always fits. */
export function parseBackup(text: string | null, data: Store): BackupResult {
  let value: unknown;
  try {
    value = JSON.parse(text ?? "");
  } catch {
    return { ok: false, reason: "bad" };
  }
  const parsed = planRecordSchema.safeParse(value);
  if (!parsed.success) return { ok: false, reason: "bad" };
  const replaces = data.plans.some((plan) => plan.id === parsed.data.id);
  return replaces || canAddPlan(data)
    ? { ok: true, record: withCleanEnrichment(parsed.data) }
    : { ok: false, reason: "full" };
}

/** Saves a changed plan into the latest data; a plan deleted meanwhile stays deleted. */
export function savePlan(data: Store, record: PlanRecord): Store {
  return { ...data, plans: data.plans.map((plan) => (plan.id === record.id ? record : plan)) };
}
