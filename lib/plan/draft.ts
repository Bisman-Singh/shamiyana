import type {
  CommunityKind,
  EventType,
  FoodPref,
  Honoree,
  Style,
  WeddingFunction,
} from "./constants";
import { LIMITS } from "./constants";
import { addDays, daysBetween, isIsoDate } from "./dates";
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

export type DraftField = "title" | "date" | "city" | "guests" | "budget" | "functions" | "notes";
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

export const DRAFT_FIELDS: readonly DraftField[] = [
  "title",
  "date",
  "city",
  "guests",
  "budget",
  "functions",
  "notes",
];

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

/** Example briefs, dated from today so they are always in the future. */
export function sampleDraft(type: EventType, today: string, title: string): Draft {
  const samples: Record<EventType, Draft> = {
    wedding: {
      ...emptyDraft("wedding"),
      title,
      date: addDays(today, 120),
      city: "Jaipur",
      guests: "250",
      budget: "1800000",
      notes: "Outdoor pheras if the weather allows.",
      functions: ["haldi", "mehndi", "sangeet", "wedding"],
    },
    birthday: {
      ...emptyDraft("birthday"),
      title,
      date: addDays(today, 45),
      city: "Lucknow",
      guests: "60",
      budget: "150000",
      style: "modern",
      food: "mixed",
      honoree: "milestone",
    },
    community: {
      ...emptyDraft("community"),
      title,
      date: addDays(today, 21),
      city: "Pune",
      guests: "400",
      budget: "200000",
      style: "eco",
      notes: "Society ground, evening only.",
      kind: "festival",
    },
  };
  return samples[type];
}

/** Digits from typed text: "₹18,00,000" and "18 00 000" both read as 1800000. */
export function readAmount(text: string): number | null {
  const digits = text.replace(/[^\d]/g, "");
  if (digits === "" || digits.length > 12) return null;
  return Number(digits);
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

const ISSUE_FIELD: Record<string, DraftError> = {
  title: "title",
  city: "city",
  guests: "guests",
  budget: "budget",
  functions: "functions",
  notes: "notes",
};

export type DraftResult =
  { ok: true; brief: Brief } | { ok: false; errors: Partial<Record<DraftField, DraftError>> };

/** Validates with the same schema the server uses, plus the date window from the user's today. */
export function parseDraft(draft: Draft, today: string): DraftResult {
  const errors: Partial<Record<DraftField, DraftError>> = {};
  const parsed = briefSchema.safeParse(candidate(draft));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      const error = ISSUE_FIELD[key];
      if (error) errors[key as DraftField] = error;
    }
  }
  const date = dateError(draft.date, today);
  if (date) errors.date = date;
  if (!parsed.success || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, brief: parsed.data };
}
