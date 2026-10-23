import type { Dictionary } from "@/lib/i18n/en";
import { format, formatDate, formatMoney } from "@/lib/i18n/format";
import type { ShiftPreview } from "@/lib/plan/budget";
import type { Change } from "@/lib/plan/changes";
import type { Locale } from "@/lib/plan/constants";

/** Plain words for a proposed change, so the user knows exactly what they approve. */
export function describeChange(
  change: Change,
  dict: Dictionary,
  locale: Locale,
  preview: ShiftPreview,
): string {
  const labels = dict.refine.changes;
  switch (change.op) {
    case "set_budget":
      return format(labels.set_budget, { amount: formatMoney(change.amount, locale) });
    case "set_guests":
      return format(labels.set_guests, { n: change.count });
    case "set_date":
      return format(labels.set_date, { date: formatDate(change.date, locale) });
    case "shift_category": {
      const { before, after } = preview(change.category, change.factor);
      return format(change.factor >= 1 ? labels.shift_more : labels.shift_less, {
        category: dict.categories[change.category],
        before: formatMoney(before, locale),
        after: formatMoney(after, locale),
      });
    }
    case "add_task":
      return format(labels.add_task, { title: change.title, weeks: change.weeksBefore });
    case "add_idea":
      return format(labels.add_idea, { title: change.title });
  }
}
