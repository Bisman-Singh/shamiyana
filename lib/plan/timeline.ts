import type { TaskArea } from "./constants";
import { addDays, daysBetween, isIsoDate } from "./dates";
import { customTaskSchema, type PlanRecord } from "./schema";
import { tasksFor } from "./task-templates";

export const PHASES = [
  "six_months",
  "three_months",
  "one_month",
  "two_weeks",
  "final_days",
  "event_day",
] as const;
export type Phase = (typeof PHASES)[number];

/** The checklist phase for a task due this many days before the event. */
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

  const templates = tasksFor(brief).map((template) => ({
    id: template.id,
    area: template.area,
    leadDays: template.leadDays,
    source: "template" as const,
    title: null,
  }));
  const items = [...templates, ...record.tasks]
    .filter((task) => !hidden.has(task.id))
    .map((task, order) => {
      const due = addDays(brief.date, -task.leadDays);
      const isDone = done.has(task.id);
      return {
        item: {
          ...task,
          due,
          phase: phaseOf(task.leadDays),
          done: isDone,
          late: !isDone && daysBetween(today, due) < 0,
        },
        order,
      };
    })
    .sort((left, right) => right.item.leadDays - left.item.leadDays || left.order - right.order)
    .map(({ item }) => item);

  return {
    items,
    daysToGo,
    doneCount: items.filter((item) => item.done).length,
    lateCount: items.filter((item) => item.late).length,
  };
}

/** A task as typed into the add form, before it gets an id and an area. */
export type ParsedTask =
  | { ok: true; task: { title: string; leadDays: number } }
  | { ok: false; invalid: ("title" | "date")[] };

/** A new task needs a title within the limit and a date from today up to the event. */
export function parseNewTask(
  title: string,
  date: string,
  today: string,
  eventDate: string,
): ParsedTask {
  const named = customTaskSchema.shape.title.safeParse(title);
  const leadDays = isIsoDate(date) ? daysBetween(date, eventDate) : -1;
  const dated = leadDays >= 0 && daysBetween(today, date) >= 0;
  if (named.success && dated) return { ok: true, task: { title: named.data, leadDays } };
  const invalid: ("title" | "date")[] = [];
  if (!named.success) invalid.push("title");
  if (!dated) invalid.push("date");
  return { ok: false, invalid };
}
