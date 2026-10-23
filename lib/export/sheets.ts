import type { Dictionary } from "@/lib/i18n/en";
import type { BudgetSummary } from "@/lib/plan/budget";
import type { Guest } from "@/lib/plan/schema";
import type { VendorCard } from "@/lib/plan/vendors";

/**
 * Spreadsheet rows for the CSV downloads, headed in the user's language.
 */

/** One CSV row: text and numbers, in column order. */
type Row = (string | number)[];

/** Budget rows for the CSV export, headed in the chosen language. */
export function budgetRows(summary: BudgetSummary, dict: Dictionary): Row[] {
  return [
    [
      dict.budget.category,
      dict.budget.planned,
      dict.budget.share,
      dict.budget.agreed,
      dict.budget.paid,
      dict.budget.status,
    ],
    ...summary.rows.map((row) => [
      dict.categories[row.category],
      row.amount,
      `${(row.share * 100).toFixed(1)}%`,
      row.quote,
      row.paid,
      dict.vendors.statuses[row.status],
    ]),
    [dict.budget.total, summary.total, "100%", summary.committed, summary.paid, ""],
  ];
}

/** Vendor checklist rows for the CSV export. */
export function checklistRows(cards: readonly VendorCard[], dict: Dictionary): Row[] {
  return [
    [
      dict.budget.category,
      dict.budget.status,
      dict.budget.planned,
      dict.vendors.agreed,
      dict.vendors.paid,
      dict.vendors.note,
      dict.vendors.ask,
    ],
    ...cards.map((card) => [
      dict.categories[card.category],
      dict.vendors.statuses[card.progress.status],
      card.planned,
      card.progress.quote,
      card.progress.paid,
      card.progress.note,
      [...dict.vendors.questions[card.category], ...card.aiQuestions].join(" | "),
    ]),
  ];
}

/** Guest list rows for the CSV export. */
export function guestRows(guests: readonly Guest[], dict: Dictionary): Row[] {
  return [
    [dict.guests.name, dict.guests.group, dict.guests.party, dict.guests.rsvp, dict.guests.diet],
    ...guests.map((guest) => [
      guest.name,
      dict.guests.groups[guest.group],
      guest.party,
      dict.guests.rsvps[guest.rsvp],
      dict.guests.diets[guest.diet],
    ]),
  ];
}
