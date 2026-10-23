"use client";

import { downloadText } from "@/lib/client/download";
import { fileName } from "@/lib/export/file-name";
import type { Dictionary } from "@/lib/i18n/en";
import { formatDate, plural } from "@/lib/i18n/format";
import { langOf } from "@/lib/i18n/lang";
import type { Locale } from "@/lib/plan/constants";
import { useLocale, useMoney } from "@/components/locale-provider";
import type { PlanView } from "@/components/planner/types";
import { useFocusOnMount } from "@/components/ui/focus";

interface PlanHeaderProps {
  titleId: string;
  view: PlanView;
  focusOnOpen: boolean;
  onEdit: () => void;
  onShare: () => void;
}

/** The plan's title, key facts, countdown and the actions that apply to the whole plan. */
export function PlanHeader({
  titleId,
  view,
  focusOnOpen,
  onEdit,
  onShare,
}: Readonly<PlanHeaderProps>) {
  const { dict, locale } = useLocale();
  const money = useMoney();
  const titleRef = useFocusOnMount<HTMLHeadingElement>(focusOnOpen);
  const { brief } = view.record;
  const days = view.timeline.daysToGo;
  const when = countdown(locale, dict.workspace, days);
  return (
    <header className="plan-head">
      <div>
        <h1 id={titleId} ref={titleRef} tabIndex={-1} lang={langOf(brief.title, locale)}>
          {brief.title}
        </h1>
        <p className="plan-facts">
          <span>{formatDate(brief.date, locale, true)}</span>
          <span>{brief.city}</span>
          <span>{plural(locale, dict.workspace.guests, brief.guests)}</span>
          <span>{money(brief.budget)}</span>
        </p>
        <p className={days < 0 ? "countdown is-over" : "countdown"}>{when}</p>
      </div>
      <div className="plan-actions">
        <button type="button" className="btn" onClick={onEdit}>
          {dict.workspace.edit}
        </button>
        <button type="button" className="btn" onClick={onShare}>
          {dict.workspace.share}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            downloadText(
              fileName(brief.title, "json"),
              "application/json",
              JSON.stringify(view.record, null, 2),
            );
          }}
        >
          {dict.downloads.backup}
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            window.print();
          }}
        >
          {dict.workspace.print}
        </button>
      </div>
    </header>
  );
}

/** Days to go, today, or past, in the plan's words. */
function countdown(locale: Locale, labels: Dictionary["workspace"], days: number): string {
  if (days > 0) return plural(locale, labels.daysToGo, days);
  return days === 0 ? labels.isToday : labels.isPast;
}
