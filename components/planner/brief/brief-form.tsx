"use client";

import { useId, useRef, useState, type SubmitEvent } from "react";
import { emptyDraft, parseDraft, type Draft, type DraftErrors } from "@/lib/plan/draft";
import { sampleDraft } from "@/lib/plan/samples";
import type { Brief } from "@/lib/plan/schema";
import { useLocale } from "@/components/locale-provider";
import { useFocusOnMount } from "@/components/ui/focus";
import { BasicFields } from "./basic-fields";
import { ErrorSummary } from "./error-summary";
import { EventTypeField } from "./event-type-field";
import type { FieldsProps } from "./fields-props";
import { PreferenceFields } from "./preference-fields";
import { SamplePicker } from "./sample-picker";
import { VariantField } from "./variant-field";

interface BriefFormProps {
  initial?: Draft;
  today: string;
  editing: boolean;
  /** Move focus to the heading when the form opens from an action, not on first page load. */
  focusOnOpen?: boolean;
  onSubmit: (brief: Brief) => void;
  onCancel?: () => void;
}

/** The brief form for a new plan or an edit, with an error summary that takes focus. */
export function BriefForm({
  initial,
  today,
  editing,
  focusOnOpen = false,
  onSubmit,
  onCancel,
}: Readonly<BriefFormProps>) {
  const { dict } = useLocale();
  const baseId = useId();
  const [draft, setDraft] = useState<Draft>(() => initial ?? emptyDraft());
  const [errors, setErrors] = useState<DraftErrors>({});
  const summaryRef = useRef<HTMLDivElement>(null);
  const headingRef = useFocusOnMount<HTMLHeadingElement>(focusOnOpen);
  const idOf = (name: string) => `${baseId}-${name}`;

  const fields: FieldsProps = {
    draft,
    set: (key, value) => {
      setDraft((current) => ({ ...current, [key]: value }));
    },
    error: (field) => {
      const code = errors[field];
      return code ? dict.form.errors[code] : undefined;
    },
    idOf,
  };

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parseDraft(draft, today);
    if (result.ok) {
      setErrors({});
      onSubmit(result.brief);
      return;
    }
    setErrors(result.errors);
    requestAnimationFrame(() => summaryRef.current?.focus());
  }

  return (
    <form className="brief-form" onSubmit={submit} noValidate aria-labelledby={idOf("heading")}>
      <h1 id={idOf("heading")} ref={headingRef} tabIndex={-1}>
        {editing ? dict.form.headingEdit : dict.form.headingNew}
      </h1>
      {editing ? null : <p className="lede">{dict.form.intro}</p>}
      <p className="hint">{dict.form.required}</p>
      <ErrorSummary errors={errors} idOf={idOf} summaryRef={summaryRef} />
      {editing ? null : (
        <SamplePicker
          onPick={(type) => {
            setDraft(
              sampleDraft(type, today, {
                title: dict.form.sampleTitles[type],
                city: dict.form.sampleCities[type],
                notes: dict.form.sampleNotes[type],
              }),
            );
            setErrors({});
          }}
        />
      )}
      <EventTypeField {...fields} />
      <BasicFields {...fields} today={today} />
      <VariantField {...fields} />
      <PreferenceFields {...fields} />
      <div className="actions">
        <button type="submit" className="btn btn-primary">
          {editing ? dict.form.submitEdit : dict.form.submitNew}
        </button>
        {onCancel ? (
          <button type="button" className="btn" onClick={onCancel}>
            {dict.common.cancel}
          </button>
        ) : null}
      </div>
    </form>
  );
}
