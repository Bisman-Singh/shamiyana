import type { Change } from "./changes";
import { LIMITS, type CategoryId, type TaskArea } from "./constants";
import { sanitizeEnrichment, type Enrichment } from "./enrichment";
import { shiftableCategories } from "./catalog";
import {
  factsOf,
  type Brief,
  type CustomTask,
  type Guest,
  type PlanRecord,
  type SavedIdea,
  type VendorProgress,
} from "./schema";

/**
 * Every edit to a plan is a pure function from one record to the next, which
 * keeps undo a matter of holding the previous value and makes each rule easy
 * to test.
 */

export function newId(): string {
  return crypto.randomUUID();
}

/** A short id that stays the same for the same text, from a 32 bit FNV-1a hash. */
export function stableId(prefix: string, text: string): string {
  let hash = 0x811c9dc5;
  for (const unit of new TextEncoder().encode(text)) {
    hash ^= unit;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${prefix}-${hash.toString(36)}`;
}

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
  return enrichment.tasks.flatMap((t) => {
    const id = stableId("ai", `${t.title}|${t.area}|${t.weeksBefore}`);
    if (seen.has(id)) return [];
    seen.add(id);
    return [
      { id, title: t.title, area: t.area, leadDays: t.weeksBefore * 7, source: "ai" as const },
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
  const kept = record.tasks.filter((t) => t.source !== "ai" || done.has(t.id));
  const keptIds = new Set(kept.map((t) => t.id));
  const fresh = aiTasks(enrichment).filter((t) => !keptIds.has(t.id));
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

export function updateBrief(record: PlanRecord, brief: Brief, now: string): PlanRecord {
  return touch(record, now, { brief });
}

export function toggleTask(record: PlanRecord, taskId: string, now: string): PlanRecord {
  const done = record.done.includes(taskId)
    ? record.done.filter((id) => id !== taskId)
    : [...record.done, taskId];
  return touch(record, now, { done });
}

/** Deletes an AI or custom task; hides a template task so it can be restored. */
export function removeTask(record: PlanRecord, taskId: string, now: string): PlanRecord {
  const done = record.done.filter((id) => id !== taskId);
  if (record.tasks.some((t) => t.id === taskId)) {
    return touch(record, now, { tasks: record.tasks.filter((t) => t.id !== taskId), done });
  }
  return touch(record, now, { hidden: [...new Set([...record.hidden, taskId])], done });
}

export function restoreHiddenTasks(record: PlanRecord, now: string): PlanRecord {
  return touch(record, now, { hidden: [] });
}

export interface NewTask {
  title: string;
  area: TaskArea;
  leadDays: number;
}

export function addTask(record: PlanRecord, task: NewTask, id: string, now: string): PlanRecord {
  if (record.tasks.length >= LIMITS.customTasksMax) return record;
  return touch(record, now, { tasks: [...record.tasks, { id, ...task, source: "custom" }] });
}

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

export function upsertGuest(record: PlanRecord, guest: Guest, now: string): PlanRecord {
  const exists = record.guests.some((g) => g.id === guest.id);
  if (!exists && record.guests.length >= LIMITS.guestListMax) return record;
  const guests = exists
    ? record.guests.map((g) => (g.id === guest.id ? guest : g))
    : [...record.guests, guest];
  return touch(record, now, { guests });
}

export function removeGuest(record: PlanRecord, guestId: string, now: string): PlanRecord {
  return touch(record, now, { guests: record.guests.filter((g) => g.id !== guestId) });
}

export const IDEAS_MAX = 40;

export function saveIdea(record: PlanRecord, idea: SavedIdea, now: string): PlanRecord {
  const duplicate = record.ideas.some((i) => i.title === idea.title && i.area === idea.area);
  if (duplicate || record.ideas.length >= IDEAS_MAX) return record;
  return touch(record, now, { ideas: [...record.ideas, idea] });
}

export function removeIdea(record: PlanRecord, ideaId: string, now: string): PlanRecord {
  return touch(record, now, { ideas: record.ideas.filter((i) => i.id !== ideaId) });
}

function applyOne(record: PlanRecord, change: Change, id: string, now: string): PlanRecord {
  switch (change.op) {
    case "set_budget":
      return updateBrief(record, { ...record.brief, budget: change.amount }, now);
    case "set_guests":
      return updateBrief(record, { ...record.brief, guests: change.count }, now);
    case "set_date":
      return updateBrief(record, { ...record.brief, date: change.date }, now);
    case "shift_category":
      return setFactor(record, change.category, change.factor, now);
    case "add_task":
      return addTask(
        record,
        { title: change.title, area: change.area, leadDays: change.weeksBefore * 7 },
        id,
        now,
      );
    case "add_idea":
      return saveIdea(
        record,
        { id, area: change.area, title: change.title, detail: change.detail },
        now,
      );
  }
}

/** Applies approved changes in order; `ids` supplies an id for each added item. */
export function applyChanges(
  record: PlanRecord,
  changes: readonly Change[],
  ids: () => string,
  now: string,
): PlanRecord {
  return changes.reduce((acc, change) => applyOne(acc, change, ids(), now), record);
}
