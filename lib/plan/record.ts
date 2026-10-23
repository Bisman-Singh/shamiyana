import { stableId } from "@/lib/shared/ids";
import { LIMITS, type CategoryId, type TaskArea } from "./constants";
import { sanitizeEnrichment, type Enrichment } from "./enrichment";
import {
  factsOf,
  type Brief,
  type CustomTask,
  type Guest,
  type PlanRecord,
  type SavedIdea,
  type VendorProgress,
} from "./schema";
import { shiftableCategories } from "./shares";

/**
 * Every edit to a plan is a pure function from one record to the next, which
 * keeps undo a matter of holding the previous value and makes each rule easy
 * to test.
 */

/** A new plan from a brief, with nothing done yet. */
export function createRecord(brief: Brief, id: string, now: string): PlanRecord {
  return {
    id,
    createdAt: now,
    updatedAt: now,
    brief,
    enrichment: null,
    enrichedFor: null,
    factors: {},
    tasks: [],
    hidden: [],
    done: [],
    vendors: {},
    ideas: [],
    guests: [],
  };
}

function touch(record: PlanRecord, now: string, patch: Partial<PlanRecord>): PlanRecord {
  return { ...record, ...patch, updatedAt: now };
}

function aiTasks(enrichment: Enrichment): CustomTask[] {
  const seen = new Set<string>();
  return enrichment.tasks.flatMap((task) => {
    const id = stableId("ai", `${task.title}|${task.area}|${task.weeksBefore}`);
    if (seen.has(id)) return [];
    seen.add(id);
    return [
      {
        id,
        title: task.title,
        area: task.area,
        leadDays: task.weeksBefore * 7,
        source: "ai" as const,
      },
    ];
  });
}

/**
 * Stores a fresh AI enrichment. Suggested tasks join the timeline; earlier AI
 * tasks the user has not ticked off are replaced, finished ones are kept.
 */
export function withEnrichment(
  record: PlanRecord,
  enrichment: Enrichment,
  enrichedFor: PlanRecord["enrichedFor"],
  now: string,
): PlanRecord {
  const done = new Set(record.done);
  const kept = record.tasks.filter((task) => task.source !== "ai" || done.has(task.id));
  const keptIds = new Set(kept.map((task) => task.id));
  const fresh = aiTasks(enrichment).filter((task) => !keptIds.has(task.id));
  return touch(record, now, {
    enrichment,
    enrichedFor,
    tasks: [...kept, ...fresh].slice(0, LIMITS.customTasksMax),
  });
}

/**
 * Re-cleans the AI text in a plan that came from outside this browser, a
 * share link or a backup file. Schema checks bound its length; this also
 * strips control and direction-override characters, as for a fresh answer.
 */
export function withCleanEnrichment(record: PlanRecord): PlanRecord {
  if (!record.enrichment) return record;
  return {
    ...record,
    enrichment: sanitizeEnrichment(record.enrichment, shiftableCategories(factsOf(record.brief))),
  };
}

/** The plan with a new brief. */
export function updateBrief(record: PlanRecord, brief: Brief, now: string): PlanRecord {
  return touch(record, now, { brief });
}

/** The plan with a task ticked or unticked. */
export function toggleTask(record: PlanRecord, taskId: string, now: string): PlanRecord {
  const done = record.done.includes(taskId)
    ? record.done.filter((id) => id !== taskId)
    : [...record.done, taskId];
  return touch(record, now, { done });
}

/** Deletes an AI or custom task; hides a template task so it can be restored. */
export function removeTask(record: PlanRecord, taskId: string, now: string): PlanRecord {
  const done = record.done.filter((id) => id !== taskId);
  if (record.tasks.some((task) => task.id === taskId)) {
    return touch(record, now, { tasks: record.tasks.filter((task) => task.id !== taskId), done });
  }
  return touch(record, now, { hidden: [...new Set([...record.hidden, taskId])], done });
}

/** The plan with every removed task back. */
export function restoreHiddenTasks(record: PlanRecord, now: string): PlanRecord {
  return touch(record, now, { hidden: [] });
}

export interface NewTask {
  title: string;
  area: TaskArea;
  leadDays: number;
}

/** The plan with a task of the user's own, unless the limit is reached. */
export function addTask(record: PlanRecord, task: NewTask, id: string, now: string): PlanRecord {
  if (record.tasks.length >= LIMITS.customTasksMax) return record;
  return touch(record, now, { tasks: [...record.tasks, { id, ...task, source: "custom" }] });
}

/** The plan with a vendor's progress set. */
export function setVendor(
  record: PlanRecord,
  category: CategoryId,
  progress: VendorProgress,
  now: string,
): PlanRecord {
  return touch(record, now, { vendors: { ...record.vendors, [category]: progress } });
}

/** Sets a category's budget weight; 1 or null removes the shift. */
export function setFactor(
  record: PlanRecord,
  category: CategoryId,
  factor: number | null,
  now: string,
): PlanRecord {
  const rest = Object.fromEntries(
    Object.entries(record.factors).filter(([key]) => key !== category),
  );
  const factors = factor === null || factor === 1 ? rest : { ...rest, [category]: factor };
  return touch(record, now, { factors });
}

/** The plan with a guest added or changed, unless the list is full. */
export function upsertGuest(record: PlanRecord, guest: Guest, now: string): PlanRecord {
  const exists = record.guests.some((other) => other.id === guest.id);
  if (!exists && record.guests.length >= LIMITS.guestListMax) return record;
  const guests = exists
    ? record.guests.map((other) => (other.id === guest.id ? guest : other))
    : [...record.guests, guest];
  return touch(record, now, { guests });
}

/** The plan without a guest. */
export function removeGuest(record: PlanRecord, guestId: string, now: string): PlanRecord {
  return touch(record, now, { guests: record.guests.filter((other) => other.id !== guestId) });
}

/** Whether the plan already holds this idea: the same title for the same area. */
export function isIdeaSaved(record: PlanRecord, idea: Pick<SavedIdea, "title" | "area">): boolean {
  return record.ideas.some((saved) => saved.title === idea.title && saved.area === idea.area);
}

/** The plan with an idea saved, unless it is saved already or the list is full. */
export function saveIdea(record: PlanRecord, idea: SavedIdea, now: string): PlanRecord {
  if (isIdeaSaved(record, idea) || record.ideas.length >= LIMITS.savedIdeasMax) return record;
  return touch(record, now, { ideas: [...record.ideas, idea] });
}

/** The plan without a saved idea. */
export function removeIdea(record: PlanRecord, ideaId: string, now: string): PlanRecord {
  return touch(record, now, { ideas: record.ideas.filter((saved) => saved.id !== ideaId) });
}
