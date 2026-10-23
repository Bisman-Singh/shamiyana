"use client";

import { downloadCsv } from "@/lib/client/download";
import { budgetRows } from "@/lib/export/sheets";
import { format } from "@/lib/i18n/format";
import type { Enrichment } from "@/lib/plan/enrichment";
import { setFactor } from "@/lib/plan/record";
import { useLocale, useMoney } from "@/components/locale-provider";
import type { PlanView, Shift, Update } from "@/components/planner/types";
import { useAnnounce } from "@/components/ui/announcer";
import { BudgetSuggestions } from "./budget-suggestions";
import { BudgetTable } from "./budget-table";

interface BudgetPanelProps {
  view: PlanView;
  ideas: Enrichment | null;
  update: Update;
}

/** The budget split with weights to adjust, AI shifts to apply, and a CSV export. */
export function BudgetPanel({ view, ideas, update }: Readonly<BudgetPanelProps>) {
  const { dict } = useLocale();
  const money = useMoney();
  const { budget, record } = view;
  const announce = useAnnounce();
  const shift: Shift = (category, factor) => {
    const { after } = view.preview(category, factor ?? 1);
    update((current, now) => setFactor(current, category, factor, now));
    announce(
      format(dict.budget.nowPlanned, { category: dict.categories[category], amount: money(after) }),
    );
  };
  const over = budget.remaining < 0;

  return (
    <div className="budget">
      <div className="panel-head">
        <h2>{dict.budget.heading}</h2>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            downloadCsv(record.brief.title, "budget", budgetRows(budget, dict));
          }}
        >
          {dict.budget.csv}
        </button>
      </div>
      <p className={over ? "notice-inline is-over" : "notice-inline"}>
        {format(over ? dict.budget.overTotal : dict.budget.remaining, {
          amount: money(Math.abs(budget.remaining)),
        })}{" "}
        {budget.perGuestCatering === null
          ? null
          : format(dict.budget.perGuest, { amount: money(budget.perGuestCatering) })}
      </p>
      <p className="hint">{dict.budget.estimate}</p>
      <BudgetTable view={view} shift={shift} />
      {ideas && ideas.shifts.length > 0 ? (
        <BudgetSuggestions
          ideas={ideas}
          factors={record.factors}
          preview={view.preview}
          shift={shift}
        />
      ) : null}
    </div>
  );
}
