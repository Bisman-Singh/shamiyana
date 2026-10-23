"use client";

import { useLocale } from "@/components/locale-provider";

/** What the server renders until the saved plans are read from the browser. */
export function PlannerSkeleton() {
  const { dict } = useLocale();
  return (
    <div className="skeleton" aria-busy="true">
      <p className="visually-hidden">{dict.common.loading}</p>
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
      <div className="skeleton-block" />
    </div>
  );
}
