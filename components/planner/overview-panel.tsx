"use client";

import { useId } from "react";
import { format, formatDate, formatNumber } from "@/lib/i18n/format";
import { langOf } from "@/lib/i18n/lang";
import type { Enrichment } from "@/lib/plan/enrichment";
import { vendorTally } from "@/lib/plan/vendors";
import { ThemeSummary } from "./theme-summary";
import { useLocale, useMoney } from "../locale-provider";
import { taskTitle } from "./task-title";
import type { PlanView } from "./types";

/** Tasks shown under "Next up". */
const NEXT_UP = 5;

interface KeyFiguresProps {
  view: PlanView;
}

/** The six numbers that say where the plan stands. */
function KeyFigures({ view }: Readonly<KeyFiguresProps>) {
  const { dict, locale } = useLocale();
  const money = useMoney();
  const o = dict.overview;
  const { budget, timeline, guests } = view;
  const tally = vendorTally(view.vendors);
  const n = (value: number) => formatNumber(value, locale);
  return (
    <dl className="ledger">
      <div>
        <dt>{o.leftToCommit}</dt>
        <dd className={budget.remaining < 0 ? "is-over" : undefined}>{money(budget.remaining)}</dd>
      </div>
      <div>
        <dt>{o.committed}</dt>
        <dd>{money(budget.committed)}</dd>
      </div>
      <div>
        <dt>{o.tasksDone}</dt>
        <dd>{format(o.of, { a: n(timeline.doneCount), b: n(timeline.items.length) })}</dd>
      </div>
      <div>
        <dt>{o.overdue}</dt>
        <dd className={timeline.lateCount > 0 ? "is-over" : undefined}>{n(timeline.lateCount)}</dd>
      </div>
      <div>
        <dt>{o.vendorsBooked}</dt>
        <dd>{format(o.of, { a: n(tally.booked + tally.paid), b: n(view.vendors.length) })}</dd>
      </div>
      <div>
        <dt>{o.expected}</dt>
        <dd>{n(guests.parties > 0 ? guests.expected : view.record.brief.guests)}</dd>
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
  const o = dict.overview;
  const open = view.timeline.items
    .filter((i) => !i.done)
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, NEXT_UP);
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{o.next}</h2>
      {open.length === 0 ? (
        <p>{o.allDone}</p>
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
  const o = dict.overview;
  return (
    <>
      <ThemeSummary theme={ideas.theme} heading={o.theme} level={2} />
      {ideas.risks.length === 0 ? null : (
        <section aria-labelledby={`${id}-risks`}>
          <h2 id={`${id}-risks`}>{o.risks}</h2>
          <ul className="plain-list">
            {ideas.risks.map((r) => (
              <li key={r.risk} lang={langOf(r.risk + r.mitigation, locale)}>
                <strong>{r.risk}</strong> {r.mitigation}
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
