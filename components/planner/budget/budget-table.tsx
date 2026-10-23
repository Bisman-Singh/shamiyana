"use client";

import { format } from "@/lib/i18n/format";
import type { BudgetRow } from "@/lib/plan/budget";
import { useLocale, useMoney } from "@/components/locale-provider";
import type { PlanView, Shift } from "@/components/planner/types";
import { BudgetStepper } from "./budget-stepper";

interface BudgetLineRowProps {
  row: BudgetRow;
  widest: number;
  factor: number;
  shift: Shift;
}

/** One budget line as a table row, with its share bar and weight stepper. */
function BudgetLineRow({ row, widest, factor, shift }: Readonly<BudgetLineRowProps>) {
  const { dict } = useLocale();
  const money = useMoney();
  const fixed = row.category === "contingency";
  return (
    <tr>
      <th scope="row">
        <span className="row-name">{dict.categories[row.category]}</span>
        <svg className="share-bar" width="100%" height="6" aria-hidden="true" focusable="false">
          <rect width={`${(row.share / widest) * 100}%`} height="6" rx="1" />
        </svg>
        {fixed ? <span className="hint">{dict.budget.contingency}</span> : null}
      </th>
      <td className="num">{money(row.amount)}</td>
      <td className="num">{`${(row.share * 100).toFixed(1)}%`}</td>
      <td className="num">
        {row.quote > 0 ? money(row.quote) : "–"}
        {row.variance > 0 ? (
          <span className="tag tag-late">
            {format(dict.budget.overLine, { amount: money(row.variance) })}
          </span>
        ) : null}
      </td>
      <td>{dict.vendors.statuses[row.status]}</td>
      <td>{fixed ? null : <BudgetStepper row={row} factor={factor} shift={shift} />}</td>
    </tr>
  );
}

interface BudgetTableProps {
  view: PlanView;
  shift: Shift;
}

/** Every budget line with its plan, share, agreed price and status, and the totals. */
export function BudgetTable({ view, shift }: Readonly<BudgetTableProps>) {
  const { dict } = useLocale();
  const money = useMoney();
  const { budget, record } = view;
  const widest = Math.max(...budget.rows.map((line) => line.share));
  return (
    <div className="table-scroll">
      <table className="ledger-table">
        <caption className="visually-hidden">{dict.budget.chartLabel}</caption>
        <thead>
          <tr>
            <th scope="col">{dict.budget.category}</th>
            <th scope="col" className="num">
              {dict.budget.planned}
            </th>
            <th scope="col" className="num">
              {dict.budget.share}
            </th>
            <th scope="col" className="num">
              {dict.budget.agreed}
            </th>
            <th scope="col">{dict.budget.status}</th>
            <th scope="col">
              <span className="visually-hidden">{dict.budget.adjust}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {budget.rows.map((row) => (
            <BudgetLineRow
              key={row.category}
              row={row}
              widest={widest}
              factor={record.factors[row.category] ?? 1}
              shift={shift}
            />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{dict.budget.total}</th>
            <td className="num">{money(budget.total)}</td>
            <td className="num">100%</td>
            <td className="num">{money(budget.committed)}</td>
            <td colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
