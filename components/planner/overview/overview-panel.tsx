"use client";

import { useId } from "react";
import { format, formatDate, formatNumber } from "@/lib/i18n/format";
import { langOf } from "@/lib/i18n/lang";
import type { Enrichment } from "@/lib/plan/enrichment";
import { vendorTally } from "@/lib/plan/vendors";
import { useLocale, useMoney } from "@/components/locale-provider";
import { taskTitle } from "@/components/planner/task-title";
import { ThemeSummary } from "@/components/planner/theme-summary";
import type { PlanView } from "@/components/planner/types";

/** Tasks shown under "Next up". */
const NEXT_UP = 5;

interface KeyFiguresProps {
  view: PlanView;
}

/** The six numbers that say where the plan stands. */
function KeyFigures({ view }: Readonly<KeyFiguresProps>) {
  const { dict, locale } = useLocale();
  const money = useMoney();
  const { budget, timeline, guests } = view;
  const tally = vendorTally(view.vendors);
  const count = (value: number) => formatNumber(value, locale);
  return (
    <dl className="ledger">
      <div>
        <dt>{dict.overview.leftToCommit}</dt>
        <dd className={budget.remaining < 0 ? "is-over" : undefined}>{money(budget.remaining)}</dd>
      </div>
      <div>
        <dt>{dict.overview.committed}</dt>
        <dd>{money(budget.committed)}</dd>
      </div>
      <div>
        <dt>{dict.overview.tasksDone}</dt>
        <dd>
          {format(dict.overview.of, {
            count: count(timeline.doneCount),
            total: count(timeline.items.length),
          })}
        </dd>
      </div>
      <div>
        <dt>{dict.overview.overdue}</dt>
        <dd className={timeline.lateCount > 0 ? "is-over" : undefined}>
          {count(timeline.lateCount)}
        </dd>
      </div>
      <div>
        <dt>{dict.overview.vendorsBooked}</dt>
        <dd>
          {format(dict.overview.of, {
            count: count(tally.booked + tally.paid),
            total: count(view.vendors.length),
          })}
        </dd>
      </div>
      <div>
        <dt>{dict.overview.expected}</dt>
        <dd>{count(guests.parties > 0 ? guests.expected : view.record.brief.guests)}</dd>
      </div>
    </dl>
  );
}

interface NextUpProps {
  view: PlanView;
}

/** The next open tasks by due date, overdue ones marked. */
function NextUp({ view }: Readonly<NextUpProps>) {
  const { dict, locale } = useLocale();
  const id = useId();
  const open = view.timeline.items
    .filter((item) => !item.done)
    .sort((first, second) => first.due.localeCompare(second.due))
    .slice(0, NEXT_UP);
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{dict.overview.next}</h2>
      {open.length === 0 ? (
        <p>{dict.overview.allDone}</p>
      ) : (
        <ol className="next-list">
          {open.map((item) => {
            const title = taskTitle(item, dict);
            return (
              <li key={item.id}>
                <span lang={langOf(title, locale)}>{title}</span>{" "}
                <span className={item.late ? "tag tag-late" : "tag"}>
                  {item.late
                    ? dict.timeline.overdue
                    : format(dict.timeline.by, { date: formatDate(item.due, locale) })}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

interface ThemeAndRisksProps {
  ideas: Enrichment;
}

/** The AI's theme and the risks it sees, each in the language it was written in. */
function ThemeAndRisks({ ideas }: Readonly<ThemeAndRisksProps>) {
  const { dict, locale } = useLocale();
  const id = useId();
  return (
    <>
      <ThemeSummary theme={ideas.theme} heading={dict.overview.theme} level={2} />
      {ideas.risks.length === 0 ? null : (
        <section aria-labelledby={`${id}-risks`}>
          <h2 id={`${id}-risks`}>{dict.overview.risks}</h2>
          <ul className="plain-list">
            {ideas.risks.map(({ risk, mitigation }) => (
              <li key={risk} lang={langOf(risk + mitigation, locale)}>
                <strong>{risk}</strong> {mitigation}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

interface OverviewPanelProps {
  view: PlanView;
  ideas: Enrichment | null;
}

/** Where the plan stands, what is next, and the AI's theme and risks once they arrive. */
export function OverviewPanel({ view, ideas }: Readonly<OverviewPanelProps>) {
  return (
    <div className="overview">
      <KeyFigures view={view} />
      <NextUp view={view} />
      {ideas ? <ThemeAndRisks ideas={ideas} /> : null}
    </div>
  );
}
