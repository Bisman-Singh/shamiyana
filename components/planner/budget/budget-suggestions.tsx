"use client";

import { useId } from "react";
import { format } from "@/lib/i18n/format";
import { langOf } from "@/lib/i18n/lang";
import type { ShiftPreview } from "@/lib/plan/budget";
import type { Enrichment } from "@/lib/plan/enrichment";
import type { Factors } from "@/lib/plan/schema";
import { useLocale, useMoney } from "@/components/locale-provider";
import type { Shift } from "@/components/planner/types";

interface BudgetSuggestionsProps {
  ideas: Enrichment;
  factors: Factors;
  preview: ShiftPreview;
  shift: Shift;
}

/** The AI's budget shifts, each showing what it would change and applied with one press. */
export function BudgetSuggestions({
  ideas,
  factors,
  preview,
  shift,
}: Readonly<BudgetSuggestionsProps>) {
  const { dict, locale } = useLocale();
  const money = useMoney();
  const id = useId();
  return (
    <section aria-labelledby={id} className="suggestions">
      <h3 id={id}>{dict.budget.suggestions}</h3>
      <ul className="plain-list">
        {ideas.shifts.map((suggestion) => {
          const applied = factors[suggestion.category] === suggestion.factor;
          // Once applied, the line already holds the shift; compare with no shift instead.
          const { before, after } = applied
            ? {
                before: preview(suggestion.category, 1).after,
                after: preview(suggestion.category, suggestion.factor).before,
              }
            : preview(suggestion.category, suggestion.factor);
          return (
            <li key={suggestion.category} className="suggestion">
              <p>
                <strong>
                  {format(dict.budget.suggestion, {
                    direction: suggestion.factor > 1 ? dict.budget.up : dict.budget.down,
                    category: dict.categories[suggestion.category],
                    before: money(before),
                    after: money(after),
                  })}
                </strong>{" "}
                <span lang={langOf(suggestion.reason, locale)}>{suggestion.reason}</span>
              </p>
              <button
                type="button"
                className="btn btn-small"
                aria-disabled={applied || undefined}
                onClick={() => {
                  if (applied) return;
                  shift(suggestion.category, suggestion.factor);
                }}
              >
                {applied ? dict.budget.applied : dict.budget.apply}{" "}
                <span className="visually-hidden">{dict.categories[suggestion.category]}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="hint">{dict.ai.disclosure}</p>
    </section>
  );
}
