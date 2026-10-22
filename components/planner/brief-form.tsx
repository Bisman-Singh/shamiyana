"use client";

import { useId, useRef, useState, type RefObject, type SubmitEvent } from "react";
import { plural } from "@/lib/i18n/format";
import { EVENT_TYPES, type EventType } from "@/lib/plan/constants";
import {
  DRAFT_FIELDS,
  emptyDraft,
  parseDraft,
  sampleDraft,
  type Draft,
  type DraftError,
  type DraftField,
} from "@/lib/plan/draft";
import type { Brief } from "@/lib/plan/schema";
import { useLocale } from "../locale-provider";
import { useFocusOnMount } from "../ui/announcer";
import {
  BasicFields,
  EventTypeField,
  PreferenceFields,
  VariantField,
  type FieldsProps,
} from "./brief-fields";

interface Props {
  initial?: Draft;
  today: string;
  editing: boolean;
  /** Move focus to the heading when the form opens from an action, not on first page load. */
  focusOnOpen?: boolean;
  onSubmit: (brief: Brief) => void;
  onCancel?: () => void;
}

type Errors = Partial<Record<DraftField, DraftError>>;

/** A focusable list of what to fix, each item linking to its field. */
function ErrorSummary({
  errors,
  idOf,
  summaryRef,
}: Readonly<{
  errors: Errors;
  idOf: (n: string) => string;
  summaryRef: RefObject<HTMLDivElement | null>;
}>) {
  const { dict, locale } = useLocale();
  const fields = DRAFT_FIELDS.flatMap((field) => {
    const code = errors[field];
    return code ? [{ field, code }] : [];
  });
  if (fields.length === 0) return null;
  return (
    <div className="error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
      <p>{plural(locale, dict.form.errorSummary, fields.length)}</p>
      <ul>
        {fields.map(({ field, code }) => (
          <li key={field}>
            <a href={`#${idOf(field)}`}>{dict.form.errors[code]}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Samples({ onPick }: Readonly<{ onPick: (type: EventType) => void }>) {
  const { dict } = useLocale();
  const headingId = useId();
  return (
    <div className="samples">
      <p id={headingId}>{dict.form.samplesLabel}</p>
      <ul className="inline-list" aria-labelledby={headingId}>
        {EVENT_TYPES.map((type) => (
          <li key={type}>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                onPick(type);
              }}
            >
              {dict.form.samples[type]}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BriefForm({
  initial,
  today,
  editing,
  focusOnOpen = false,
  onSubmit,
  onCancel,
}: Readonly<Props>) {
  const { dict } = useLocale();
  const f = dict.form;
  const baseId = useId();
  const [draft, setDraft] = useState<Draft>(() => initial ?? emptyDraft());
  const [errors, setErrors] = useState<Errors>({});
  const summaryRef = useRef<HTMLDivElement>(null);
  const headingRef = useFocusOnMount<HTMLHeadingElement>(focusOnOpen);
  const idOf = (name: string) => `${baseId}-${name}`;

  const fields: FieldsProps = {
    draft,
    set: (key, value) => {
      setDraft((d) => ({ ...d, [key]: value }));
    },
    error: (field) => {
      const code = errors[field];
      return code ? f.errors[code] : undefined;
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
        {editing ? f.headingEdit : f.headingNew}
      </h1>
      {editing ? null : <p className="lede">{f.intro}</p>}
      <ErrorSummary errors={errors} idOf={idOf} summaryRef={summaryRef} />
      {editing ? null : (
        <Samples
          onPick={(type) => {
            setDraft(
              sampleDraft(type, today, {
                title: f.sampleTitles[type],
                city: f.sampleCities[type],
                notes: f.sampleNotes[type],
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
          {editing ? f.submitEdit : f.submitNew}
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
