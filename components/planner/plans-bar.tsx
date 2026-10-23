"use client";

import { useId, useState, type ChangeEvent } from "react";
import { format } from "@/lib/i18n/format";
import { langOf } from "@/lib/i18n/lang";
import { LIMITS } from "@/lib/plan/constants";
import type { PlanRecord } from "@/lib/plan/schema";
import { useLocale } from "../locale-provider";

interface PlanPickerProps {
  plans: readonly PlanRecord[];
  initial: PlanRecord;
  onSelect: (id: string) => void;
}

/** Choosing in the list changes nothing until Open is pressed, so the page never switches under the user. */
function PlanPicker({ plans, initial, onSelect }: Readonly<PlanPickerProps>) {
  const { dict, locale } = useLocale();
  const selectId = useId();
  const [choice, setChoice] = useState(initial.id);
  return (
    <div className="field field-inline">
      <label htmlFor={selectId}>{dict.plans.switchLabel}</label>
      <select
        id={selectId}
        value={choice}
        onChange={(e) => {
          setChoice(e.target.value);
        }}
      >
        {plans.map((p) => (
          <option key={p.id} value={p.id} lang={langOf(p.brief.title, locale)}>
            {p.brief.title}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn"
        onClick={() => {
          onSelect(choice);
        }}
      >
        {dict.plans.open}
      </button>
    </div>
  );
}

interface PlansBarProps {
  plans: readonly PlanRecord[];
  active: PlanRecord | null;
  full: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRestore: (event: ChangeEvent<HTMLInputElement>) => void;
  onDelete: (() => void) | null;
}

/** Pick, start, restore or delete a saved plan. */
export function PlansBar({
  plans,
  active,
  full,
  onSelect,
  onNew,
  onRestore,
  onDelete,
}: Readonly<PlansBarProps>) {
  const { dict } = useLocale();
  const limitId = useId();
  return (
    <nav className="plans-bar" aria-label={dict.plans.heading}>
      {plans[0] ? (
        <PlanPicker
          key={active?.id ?? "none"}
          plans={plans}
          initial={active ?? plans[0]}
          onSelect={onSelect}
        />
      ) : null}
      <button
        type="button"
        className="btn"
        disabled={full}
        aria-describedby={full ? limitId : undefined}
        onClick={onNew}
      >
        {dict.plans.new}
      </button>
      {full ? (
        <p id={limitId} className="hint">
          {format(dict.plans.limit, { n: LIMITS.plansMax })}
        </p>
      ) : null}
      <label className="btn btn-quiet file-button">
        {dict.downloads.restore}
        <input
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={onRestore}
        />
      </label>
      {onDelete ? (
        <button type="button" className="btn btn-quiet" onClick={onDelete}>
          {dict.plans.delete}
        </button>
      ) : null}
    </nav>
  );
}
