import type { Dictionary } from "@/lib/i18n/en";
import type { BudgetSummary } from "@/lib/plan/budget";
import type { Guest } from "@/lib/plan/schema";
import type { VendorCard } from "@/lib/plan/vendors";

/** Spreadsheet rows for the CSV downloads, headed in the user's language. */

type Row = (string | number)[];

/** Budget rows for the CSV export, headed in the chosen language. */
export function budgetRows(summary: BudgetSummary, dict: Dictionary): Row[] {
  const b = dict.budget;
  return [
    [b.category, b.planned, b.share, b.agreed, b.paid, b.status],
    ...summary.rows.map((r) => [
      dict.categories[r.category],
      r.amount,
      `${(r.share * 100).toFixed(1)}%`,
      r.quote,
      r.paid,
      dict.vendors.statuses[r.status],
    ]),
    [b.total, summary.total, "100%", summary.committed, summary.paid, ""],
  ];
}

/** Vendor checklist rows for the CSV export. */
export function checklistRows(cards: readonly VendorCard[], dict: Dictionary): Row[] {
  const v = dict.vendors;
  return [
    [
      dict.budget.category,
      dict.budget.status,
      dict.budget.planned,
      v.agreed,
      v.paid,
      v.note,
      v.ask,
    ],
    ...cards.map((c) => [
      dict.categories[c.category],
      v.statuses[c.progress.status],
      c.planned,
      c.progress.quote,
      c.progress.paid,
      c.progress.note,
      [...v.questions[c.category], ...c.aiQuestions].join(" | "),
    ]),
  ];
}

/** Guest list rows for the CSV export. */
export function guestRows(guests: readonly Guest[], dict: Dictionary): Row[] {
  const g = dict.guests;
  return [
    [g.name, g.group, g.party, g.rsvp, g.diet],
    ...guests.map((guest) => [
      guest.name,
      g.groups[guest.group],
      guest.party,
      g.rsvps[guest.rsvp],
      g.diets[guest.diet],
    ]),
  ];
}
