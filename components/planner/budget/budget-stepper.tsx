"use client";

import { useRef } from "react";
import { format } from "@/lib/i18n/format";
import type { BudgetRow } from "@/lib/plan/budget";
import { LIMITS } from "@/lib/plan/constants";
import { nudge } from "@/lib/plan/factors";
import { useLocale } from "@/components/locale-provider";
import type { Shift } from "@/components/planner/types";

interface BudgetStepperProps {
  row: BudgetRow;
  factor: number;
  shift: Shift;
}

/** Less, More and Reset for one budget line's weight; a limit is reached, not disabled, so focus stays. */
export function BudgetStepper({ row, factor, shift }: Readonly<BudgetStepperProps>) {
  const { dict } = useLocale();
  const moreRef = useRef<HTMLButtonElement>(null);
  return (
    <div
      className="stepper"
      role="group"
      aria-label={format(dict.budget.adjustLabel, { category: dict.categories[row.category] })}
    >
      <button
        type="button"
        className="btn btn-small"
        aria-disabled={factor <= LIMITS.factorMin || undefined}
        onClick={() => {
          if (factor <= LIMITS.factorMin) return;
          shift(row.category, nudge(factor, -1));
        }}
      >
        {dict.budget.less}
      </button>
      <button
        ref={moreRef}
        type="button"
        className="btn btn-small"
        aria-disabled={factor >= LIMITS.factorMax || undefined}
        onClick={() => {
          if (factor >= LIMITS.factorMax) return;
          shift(row.category, nudge(factor, 1));
        }}
      >
        {dict.budget.more}
      </button>
      {factor === 1 ? null : (
        <button
          type="button"
          className="btn btn-small btn-quiet"
          onClick={() => {
            shift(row.category, null);
            // Reset leaves once the weight is back to 1, so focus stays in the stepper on More.
            moreRef.current?.focus();
          }}
        >
          {dict.budget.reset}{" "}
          <span className="hint">{format(dict.budget.shifted, { factor: factor.toFixed(1) })}</span>
        </button>
      )}
    </div>
  );
}
