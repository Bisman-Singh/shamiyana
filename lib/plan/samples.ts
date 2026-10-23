import type { EventType } from "./constants";
import { addDays, daysBetween, saturdayOnOrBefore } from "./dates";
import { emptyDraft, type Draft } from "./draft";
import { TASKS } from "./task-templates";

/** The words of an example in the user's language. */
export interface SampleText {
  title: string;
  city: string;
  notes: string;
}

/** Lakshmi Puja dates from published panchangs. Past the last one, the mela falls back to two months out. */
const DIWALI = ["2026-11-08", "2027-10-29", "2028-10-17", "2029-11-05"] as const;

/** The longest lead time in a checklist: a sample at least this far out opens with nothing overdue. */
function longestLead(type: EventType): number {
  return Math.max(...TASKS[type].map((t) => t.leadDays));
}

/**
 * The earliest wedding-season day, 25 November, 5 December or 10 February,
 * that leaves time for every task. When none this season does, 25 November
 * next year always does.
 */
export function winterWeddingDate(today: string): string {
  const year = Number(today.slice(0, 4));
  const days = [`${String(year)}-11-25`, `${String(year)}-12-05`, `${String(year + 1)}-02-10`];
  const lead = longestLead("wedding");
  return days.find((d) => daysBetween(today, d) >= lead) ?? `${String(year + 1)}-11-25`;
}

/** The Saturday at least six days before the next Diwali that leaves time for every task. */
export function diwaliMelaDate(today: string): string {
  const lead = longestLead("community");
  const mela = DIWALI.map((d) => saturdayOnOrBefore(addDays(d, -6))).find(
    (d) => daysBetween(today, d) >= lead,
  );
  return mela ?? addDays(today, lead);
}

/** Example briefs, dated from today so they are always in the future and in season. */
export function sampleDraft(type: EventType, today: string, text: SampleText): Draft {
  const { title, city, notes } = text;
  const samples: Record<EventType, Draft> = {
    wedding: {
      ...emptyDraft("wedding"),
      title,
      date: winterWeddingDate(today),
      city,
      guests: "250",
      budget: "1800000",
      notes,
      functions: ["haldi", "mehndi", "sangeet", "wedding"],
    },
    birthday: {
      ...emptyDraft("birthday"),
      title,
      date: addDays(today, longestLead("birthday")),
      city,
      notes,
      guests: "60",
      budget: "150000",
      style: "modern",
      food: "mixed",
      honoree: "milestone",
    },
    community: {
      ...emptyDraft("community"),
      title,
      date: diwaliMelaDate(today),
      city,
      guests: "400",
      budget: "200000",
      style: "eco",
      notes,
      kind: "festival",
    },
  };
  return samples[type];
}
