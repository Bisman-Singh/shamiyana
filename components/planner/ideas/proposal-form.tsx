"use client";

import type { ShiftPreview } from "@/lib/plan/budget";
import { useLocale } from "@/components/locale-provider";
import { describeChange } from "./describe-change";
import type { Proposal } from "./use-refine-chat";

interface ProposalFormProps {
  proposal: Proposal;
  preview: ShiftPreview;
  onChange: (next: Proposal) => void;
  onApply: () => void;
  onDiscard: () => void;
}

/** The changes the assistant proposed, each unticked until the user picks it. */
export function ProposalForm({
  proposal,
  preview,
  onChange,
  onApply,
  onDiscard,
}: Readonly<ProposalFormProps>) {
  const { dict, locale } = useLocale();
  return (
    <fieldset className="proposal">
      <legend>{dict.refine.proposed}</legend>
      {proposal.items.map((item) => (
        <label key={item.key} className="choice">
          <input
            type="checkbox"
            checked={item.picked}
            onChange={(event) => {
              onChange({
                items: proposal.items.map((other) =>
                  other.key === item.key ? { ...other, picked: event.target.checked } : other,
                ),
              });
            }}
          />
          <span>{describeChange(item.change, dict, locale, preview)}</span>
        </label>
      ))}
      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!proposal.items.some((item) => item.picked)}
          onClick={onApply}
        >
          {dict.refine.apply}
        </button>
        <button type="button" className="btn" onClick={onDiscard}>
          {dict.refine.discard}
        </button>
      </div>
    </fieldset>
  );
}
