import { TASKS } from "./catalog";
import type { TaskArea } from "./constants";
import { addDays, daysBetween } from "./dates";
import type { PlanRecord } from "./schema";

export const PHASES = [
  "six_months",
  "three_months",
  "one_month",
  "two_weeks",
  "final_days",
  "event_day",
] as const;
export type Phase = (typeof PHASES)[number];

export function phaseOf(leadDays: number): Phase {
  if (leadDays >= 180) return "six_months";
  if (leadDays >= 90) return "three_months";
  if (leadDays >= 30) return "one_month";
  if (leadDays >= 14) return "two_weeks";
  if (leadDays >= 1) return "final_days";
  return "event_day";
}

export interface TimelineItem {
  id: string;
  area: TaskArea;
  leadDays: number;
  /** The date this is ideally done by: event date minus lead time. */
  due: string;
  phase: Phase;
  source: "template" | "ai" | "custom";
  /** Free text for AI and custom tasks; template titles come from the dictionary by id. */
  title: string | null;
  done: boolean;
  /** Not done and its ideal date has passed. */
  late: boolean;
}

export interface Timeline {
  items: TimelineItem[];
  daysToGo: number;
  doneCount: number;
  lateCount: number;
}

/**
 * Back-schedules every task from the event date. A task whose usual lead
 * time no longer fits is kept at its ideal date and marked late, so the plan
 * says plainly what should already have happened instead of hiding it.
 */
export function buildTimeline(record: PlanRecord, today: string): Timeline {
  const { brief } = record;
  const hidden = new Set(record.hidden);
  const done = new Set(record.done);
  const daysToGo = daysBetween(today, brief.date);

  const templates = TASKS[brief.type]
    .filter((t) => (t.when ? t.when(brief) : true))
    .map((t) => ({
      id: t.id,
      area: t.area,
      leadDays: t.leadDays,
      source: "template" as const,
      title: null,
    }));
  const items = [...templates, ...record.tasks]
    .filter((t) => !hidden.has(t.id))
    .map((t, order) => {
      const due = addDays(brief.date, -t.leadDays);
      const isDone = done.has(t.id);
      return {
        item: {
          ...t,
          due,
          phase: phaseOf(t.leadDays),
          done: isDone,
          late: !isDone && daysBetween(today, due) < 0,
        },
        order,
      };
    })
    .sort((a, b) => b.item.leadDays - a.item.leadDays || a.order - b.order)
    .map(({ item }) => item);

  return {
    items,
    daysToGo,
    doneCount: items.filter((i) => i.done).length,
    lateCount: items.filter((i) => i.late).length,
  };
}
