"use client";

import type { RefObject } from "react";
import { plural } from "@/lib/i18n/format";
import { DRAFT_FIELDS, type DraftErrors } from "@/lib/plan/draft";
import { useLocale } from "@/components/locale-provider";

interface ErrorSummaryProps {
  errors: DraftErrors;
  idOf: (name: string) => string;
  summaryRef: RefObject<HTMLDivElement | null>;
}

/** A focusable list of what to fix, each item linking to its field. */
export function ErrorSummary({ errors, idOf, summaryRef }: Readonly<ErrorSummaryProps>) {
  const { dict, locale } = useLocale();
  const fields = DRAFT_FIELDS.flatMap((field) => {
    const code = errors[field];
    return code ? [{ field, code }] : [];
  });
  if (fields.length === 0) return null;
  return (
    <div className="error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
      <h2 className="error-summary-title">
        {plural(locale, dict.form.errorSummary, fields.length)}
      </h2>
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
