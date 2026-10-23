import { oneOf } from "@/lib/shared/untrusted";
import { readAmount } from "./amounts";
import { TASKS } from "./catalog";
import {
  LIMITS,
  type CommunityKind,
  type EventType,
  type FoodPref,
  type Honoree,
  type Style,
  type WeddingFunction,
} from "./constants";
import { addDays, daysBetween, isIsoDate, saturdayOnOrBefore } from "./dates";
import { briefSchema, type Brief } from "./schema";

/**
 * The brief form's working state. Numbers stay as typed text until submit,
 * so "18,00,000" can be typed naturally; every event type's extra fields are
 * kept, so switching type and back loses nothing.
 */
export interface Draft {
  type: EventType;
  title: string;
  date: string;
  city: string;
  guests: string;
  budget: string;
  style: Style;
  food: FoodPref;
  notes: string;
  functions: WeddingFunction[];
  honoree: Honoree;
  kind: CommunityKind;
}

export const DRAFT_FIELDS = [
  "title",
  "date",
  "city",
  "guests",
  "budget",
  "functions",
  "notes",
] as const;
export type DraftField = (typeof DRAFT_FIELDS)[number];
export type DraftError =
  | "title"
  | "city"
  | "dateInvalid"
  | "datePast"
  | "dateFar"
  | "guests"
  | "budget"
  | "functions"
  | "notes";

/** A blank draft for an event type. */
export function emptyDraft(type: EventType = "wedding"): Draft {
  return {
    type,
    title: "",
    date: "",
    city: "",
    guests: "",
    budget: "",
    style: "traditional",
    food: "veg",
    notes: "",
    functions: ["wedding"],
    honoree: "adult",
    kind: "festival",
  };
}

/** A draft filled from a saved brief, for editing. */
export function draftFromBrief(brief: Brief): Draft {
  const base = emptyDraft(brief.type);
  return {
    ...base,
    title: brief.title,
    date: brief.date,
    city: brief.city,
    guests: String(brief.guests),
    budget: String(brief.budget),
    style: brief.style,
    food: brief.food,
    notes: brief.notes,
    functions: brief.type === "wedding" ? brief.functions : base.functions,
    honoree: brief.type === "birthday" ? brief.honoree : base.honoree,
    kind: brief.type === "community" ? brief.kind : base.kind,
  };
}

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

function dateError(date: string, today: string): DraftError | null {
  if (!isIsoDate(date)) return "dateInvalid";
  const ahead = daysBetween(today, date);
  if (ahead < 0) return "datePast";
  if (ahead > LIMITS.maxDaysAhead) return "dateFar";
  return null;
}

function candidate(draft: Draft): unknown {
  const base = {
    title: draft.title,
    date: draft.date,
    city: draft.city,
    guests: readAmount(draft.guests),
    budget: readAmount(draft.budget),
    style: draft.style,
    food: draft.food,
    notes: draft.notes,
  };
  switch (draft.type) {
    case "wedding":
      return { type: "wedding", ...base, functions: draft.functions };
    case "birthday":
      return { type: "birthday", ...base, honoree: draft.honoree };
    case "community":
      return { type: "community", ...base, kind: draft.kind };
  }
}

/** What to fix in a draft, field by field. */
export type DraftErrors = Partial<Record<DraftField, DraftError>>;

const ISSUE_FIELD: DraftErrors = {
  title: "title",
  city: "city",
  guests: "guests",
  budget: "budget",
  functions: "functions",
  notes: "notes",
};

export type DraftResult = { ok: true; brief: Brief } | { ok: false; errors: DraftErrors };

/** Validates with the same schema the server uses, plus the date window from the user's today. */
export function parseDraft(draft: Draft, today: string): DraftResult {
  const errors: DraftErrors = {};
  const parsed = briefSchema.safeParse(candidate(draft));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = oneOf(issue.path[0], DRAFT_FIELDS);
      const error = field && ISSUE_FIELD[field];
      if (field && error) errors[field] = error;
    }
  }
  const date = dateError(draft.date, today);
  if (date) errors.date = date;
  if (!parsed.success || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, brief: parsed.data };
}
