"use client";

import { useLocale } from "@/components/locale-provider";

/** The page-level error boundary: says what happened and offers the one useful action. */
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { dict } = useLocale();
  return (
    <div className="page-message" role="alert">
      <h1>{dict.error.heading}</h1>
      <p>{dict.error.body}</p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        {dict.error.retry}
      </button>
    </div>
  );
}
