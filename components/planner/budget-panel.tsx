"use client";

import { useId, useRef } from "react";
import { langOf } from "@/lib/i18n/lang";
import { budgetRows } from "@/lib/export/sheets";
import { downloadCsv } from "@/lib/client/files";
import { format } from "@/lib/i18n/format";
import { previewShifts, type BudgetRow as Row, type ShiftPreview } from "@/lib/plan/budget";
import { clampFactor } from "@/lib/plan/factors";
import { LIMITS, type CategoryId } from "@/lib/plan/constants";
import type { Enrichment } from "@/lib/plan/enrichment";
import { setFactor } from "@/lib/plan/record";
import { factsOf } from "@/lib/plan/schema";
import { useLocale, useMoney } from "../locale-provider";
import { useAnnounce } from "../ui/announcer";
import type { PlanView, Update } from "./types";

const STEP = 0.1;
const MIN = LIMITS.factorMin;
const MAX = LIMITS.factorMax;

/** One step up or down on a category's weight, on the 0.1 grid and inside its bounds. */
export function nudge(current: number, direction: 1 | -1): number {
  return clampFactor(Math.round((current + direction * STEP) * 10) / 10);
}

type Shift = (category: CategoryId, factor: number | null) => void;

function Stepper({ row, factor, shift }: Readonly<{ row: Row; factor: number; shift: Shift }>) {
  const { dict } = useLocale();
  const b = dict.budget;
  const moreRef = useRef<HTMLButtonElement>(null);
  return (
    <div
      className="stepper"
      role="group"
      aria-label={format(b.adjustLabel, { category: dict.categories[row.category] })}
    >
      <button
        type="button"
        className="btn btn-small"
        aria-disabled={factor <= MIN || undefined}
        onClick={() => {
          if (factor <= MIN) return;
          shift(row.category, nudge(factor, -1));
        }}
      >
        {b.less}
      </button>
      <button
        ref={moreRef}
        type="button"
        className="btn btn-small"
        aria-disabled={factor >= MAX || undefined}
        onClick={() => {
          if (factor >= MAX) return;
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
            // Reset leaves once the weight is back to 1, so focus stays in the stepper on More.
            moreRef.current?.focus();
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
}: Readonly<{
  row: Row;
  widest: number;
  factor: number;
  shift: Shift;
}>) {
  const { dict } = useLocale();
  const money = useMoney();
  const b = dict.budget;
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
  preview,
  shift,
}: Readonly<{
  ideas: Enrichment;
  factors: PlanView["record"]["factors"];
  preview: ShiftPreview;
  shift: Shift;
}>) {
  const { dict, locale } = useLocale();
  const money = useMoney();
  const id = useId();
  const b = dict.budget;
  return (
    <section aria-labelledby={id} className="suggestions">
      <h3 id={id}>{b.suggestions}</h3>
      <ul className="plain-list">
        {ideas.shifts.map((s) => {
          const applied = factors[s.category] === s.factor;
          // Once applied, the line already holds the shift; compare with no shift instead.
          const { before, after } = applied
            ? { before: preview(s.category, 1).after, after: preview(s.category, s.factor).before }
            : preview(s.category, s.factor);
          return (
            <li key={s.category} className="suggestion">
              <p>
                <strong>
                  {format(b.suggestion, {
                    direction: s.factor > 1 ? b.up : b.down,
                    category: dict.categories[s.category],
                    before: money(before),
                    after: money(after),
                  })}
                </strong>{" "}
                <span lang={langOf(s.reason, locale)}>{s.reason}</span>
              </p>
              <button
                type="button"
                className="btn btn-small"
                aria-disabled={applied || undefined}
                onClick={() => {
                  if (applied) return;
                  shift(s.category, s.factor);
                }}
              >
                {applied ? b.applied : b.apply}{" "}
                <span className="visually-hidden">{dict.categories[s.category]}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="hint">{dict.ai.disclosure}</p>
    </section>
  );
}

function BudgetTable({ view, shift }: Readonly<{ view: PlanView; shift: Shift }>) {
  const { dict } = useLocale();
  const money = useMoney();
  const b = dict.budget;
  const { budget, record } = view;
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

/** The budget split with weights to adjust, AI shifts to apply, and a CSV export. */
export function BudgetPanel({
  view,
  ideas,
  update,
}: Readonly<{
  view: PlanView;
  ideas: Enrichment | null;
  update: Update;
}>) {
  const { dict } = useLocale();
  const money = useMoney();
  const b = dict.budget;
  const { budget, record } = view;
  const announce = useAnnounce();
  const shift: Shift = (category, factor) => {
    const { after } = previewShifts(factsOf(record.brief), record.factors)(category, factor ?? 1);
    update((r, now) => setFactor(r, category, factor, now));
    announce(format(b.nowPlanned, { category: dict.categories[category], amount: money(after) }));
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
            downloadCsv(record.brief.title, "budget", budgetRows(budget, dict));
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
        <Suggestions
          ideas={ideas}
          factors={record.factors}
          preview={previewShifts(factsOf(record.brief), record.factors)}
          shift={shift}
        />
      ) : null}
    </div>
  );
}
