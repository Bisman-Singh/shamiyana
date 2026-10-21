"use client";

import { toCsv } from "@/lib/export/csv";
import { fileName } from "@/lib/export/links";
import { budgetRows } from "@/lib/export/sheets";
import { downloadText } from "@/lib/client/files";
import { format, formatMoney } from "@/lib/i18n/format";
import type { BudgetRow as Row } from "@/lib/plan/budget";
import type { CategoryId } from "@/lib/plan/constants";
import type { Enrichment } from "@/lib/plan/enrichment";
import { setFactor } from "@/lib/plan/record";
import { useLocale } from "../locale-provider";
import type { PlanView, Update } from "./types";

const STEP = 0.1;
const MIN = 0.5;
const MAX = 1.5;

/** One step up or down on a category's weight, kept inside 0.5 to 1.5. */
export function nudge(current: number, direction: 1 | -1): number {
  return Math.round(Math.min(MAX, Math.max(MIN, current + direction * STEP)) * 10) / 10;
}

type Shift = (category: CategoryId, factor: number | null) => void;

function Stepper({ row, factor, shift }: { row: Row; factor: number; shift: Shift }) {
  const { dict } = useLocale();
  const b = dict.budget;
  return (
    <div
      className="stepper"
      role="group"
      aria-label={format(b.adjustLabel, { category: dict.categories[row.category] })}
    >
      <button
        type="button"
        className="btn btn-small"
        disabled={factor <= MIN}
        onClick={() => {
          shift(row.category, nudge(factor, -1));
        }}
      >
        {b.less}
      </button>
      <button
        type="button"
        className="btn btn-small"
        disabled={factor >= MAX}
        onClick={() => {
          shift(row.category, nudge(factor, 1));
        }}
      >
        {b.more}
      </button>
      {factor === 1 ? null : (
        <button
          type="button"
          className="btn btn-small btn-quiet"
          onClick={() => {
            shift(row.category, null);
          }}
        >
          {b.reset} <span className="hint">{format(b.shifted, { factor: factor.toFixed(1) })}</span>
        </button>
      )}
    </div>
  );
}

function BudgetLine({
  row,
  widest,
  factor,
  shift,
}: {
  row: Row;
  widest: number;
  factor: number;
  shift: Shift;
}) {
  const { dict, locale } = useLocale();
  const b = dict.budget;
  const money = (n: number) => formatMoney(n, locale);
  const fixed = row.category === "contingency";
  return (
    <tr>
      <th scope="row">
        <span className="row-name">{dict.categories[row.category]}</span>
        <svg className="share-bar" width="100%" height="6" aria-hidden="true" focusable="false">
          <rect width={`${(row.share / widest) * 100}%`} height="6" rx="1" />
        </svg>
        {fixed ? <span className="hint">{b.contingency}</span> : null}
      </th>
      <td className="num">{money(row.amount)}</td>
      <td className="num">{`${(row.share * 100).toFixed(1)}%`}</td>
      <td className="num">
        {row.quote > 0 ? money(row.quote) : "–"}
        {row.variance > 0 ? (
          <span className="tag tag-late">
            {format(b.overLine, { amount: money(row.variance) })}
          </span>
        ) : null}
      </td>
      <td>{dict.vendors.statuses[row.status]}</td>
      <td>{fixed ? null : <Stepper row={row} factor={factor} shift={shift} />}</td>
    </tr>
  );
}

function Suggestions({
  ideas,
  factors,
  shift,
}: {
  ideas: Enrichment;
  factors: PlanView["record"]["factors"];
  shift: Shift;
}) {
  const { dict } = useLocale();
  const b = dict.budget;
  return (
    <section aria-labelledby="ai-shifts" className="suggestions">
      <h3 id="ai-shifts">{b.suggestions}</h3>
      <ul className="plain-list">
        {ideas.shifts.map((s) => {
          const applied = factors[s.category] === s.factor;
          return (
            <li key={s.category} className="suggestion">
              <p>
                <strong>
                  {format(b.suggestion, {
                    direction: s.factor > 1 ? b.up : b.down,
                    category: dict.categories[s.category],
                    pct: Math.round(Math.abs(s.factor - 1) * 100),
                  })}
                </strong>{" "}
                {s.reason}
              </p>
              <button
                type="button"
                className="btn btn-small"
                disabled={applied}
                onClick={() => {
                  shift(s.category, s.factor);
                }}
              >
                {applied ? b.applied : b.apply}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="hint">{dict.ai.disclosure}</p>
    </section>
  );
}

function BudgetTable({ view, shift }: { view: PlanView; shift: Shift }) {
  const { dict, locale } = useLocale();
  const b = dict.budget;
  const { budget, record } = view;
  const money = (n: number) => formatMoney(n, locale);
  const widest = Math.max(...budget.rows.map((r) => r.share));
  return (
    <div className="table-scroll">
      <table className="ledger-table">
        <caption className="visually-hidden">{b.chartLabel}</caption>
        <thead>
          <tr>
            <th scope="col">{b.category}</th>
            <th scope="col" className="num">
              {b.planned}
            </th>
            <th scope="col" className="num">
              {b.share}
            </th>
            <th scope="col" className="num">
              {b.agreed}
            </th>
            <th scope="col">{b.status}</th>
            <th scope="col">
              <span className="visually-hidden">{b.adjust}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {budget.rows.map((row) => (
            <BudgetLine
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
            <th scope="row">{b.total}</th>
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

export function BudgetPanel({
  view,
  ideas,
  update,
}: {
  view: PlanView;
  ideas: Enrichment | null;
  update: Update;
}) {
  const { dict, locale } = useLocale();
  const b = dict.budget;
  const { budget, record } = view;
  const money = (n: number) => formatMoney(n, locale);
  const shift: Shift = (category, factor) => {
    update((r, now) => setFactor(r, category, factor, now));
  };
  const over = budget.remaining < 0;

  return (
    <div className="budget">
      <div className="panel-head">
        <h2>{b.heading}</h2>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            downloadText(
              fileName(record.brief.title, "budget.csv"),
              "text/csv;charset=utf-8",
              toCsv(budgetRows(budget, dict)),
            );
          }}
        >
          {b.csv}
        </button>
      </div>
      <p className={over ? "notice-inline is-over" : "notice-inline"}>
        {format(over ? b.overTotal : b.remaining, { amount: money(Math.abs(budget.remaining)) })}{" "}
        {budget.perGuestCatering === null
          ? null
          : format(b.perGuest, { amount: money(budget.perGuestCatering) })}
      </p>
      <BudgetTable view={view} shift={shift} />
      {ideas && ideas.shifts.length > 0 ? (
        <Suggestions ideas={ideas} factors={record.factors} shift={shift} />
      ) : null}
    </div>
  );
}
