"use client";

import { useLocale } from "@/components/locale-provider";
import { useFocusOnMount } from "@/components/ui/announcer";

/** The page-level error boundary: focus lands on what happened, with the one useful action next to it. */
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { dict } = useLocale();
  const headingRef = useFocusOnMount<HTMLHeadingElement>(true);
  return (
    <div className="page-message">
      <h1 ref={headingRef} tabIndex={-1}>
        {dict.error.heading}
      </h1>
      <p>{dict.error.body}</p>
      <button type="button" className="btn btn-primary" onClick={reset}>
        {dict.error.retry}
      </button>
    </div>
  );
}
