"use client";

import { useId } from "react";
import { format, formatDate, formatMoney, formatNumber } from "@/lib/i18n/format";
import { langOf } from "@/lib/i18n/lang";
import type { Enrichment } from "@/lib/plan/enrichment";
import { vendorTally } from "@/lib/plan/vendors";
import { useLocale } from "../locale-provider";
import { taskTitle } from "./task-title";
import type { PlanView } from "./types";

/** Tasks shown under "Next up". */
const NEXT_UP = 5;

/** The six numbers that say where the plan stands. */
function KeyFigures({ view }: Readonly<{ view: PlanView }>) {
  const { dict, locale } = useLocale();
  const o = dict.overview;
  const { budget, timeline, guests } = view;
  const tally = vendorTally(view.vendors);
  const n = (value: number) => formatNumber(value, locale);
  return (
    <dl className="ledger">
      <div>
        <dt>{o.leftToCommit}</dt>
        <dd className={budget.remaining < 0 ? "is-over" : undefined}>
          {formatMoney(budget.remaining, locale)}
        </dd>
      </div>
      <div>
        <dt>{o.committed}</dt>
        <dd>{formatMoney(budget.committed, locale)}</dd>
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

/** The next open tasks by due date, overdue ones marked. */
function NextUp({ view }: Readonly<{ view: PlanView }>) {
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

/** The AI's theme and the risks it sees, each in the language it was written in. */
function ThemeAndRisks({ ideas }: Readonly<{ ideas: Enrichment }>) {
  const { dict, locale } = useLocale();
  const id = useId();
  const o = dict.overview;
  return (
    <>
      {ideas.theme.name === "" ? null : (
        <section aria-labelledby={`${id}-theme`}>
          <h2 id={`${id}-theme`}>{o.theme}</h2>
          <h3 className="theme-name" lang={langOf(ideas.theme.name, locale)}>
            {ideas.theme.name}
          </h3>
          <p lang={langOf(ideas.theme.summary, locale)}>{ideas.theme.summary}</p>
        </section>
      )}
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

/** Where the plan stands, what is next, and the AI's theme and risks once they arrive. */
export function OverviewPanel({
  view,
  ideas,
}: Readonly<{ view: PlanView; ideas: Enrichment | null }>) {
  return (
    <div className="overview">
      <KeyFigures view={view} />
      <NextUp view={view} />
      {ideas ? <ThemeAndRisks ideas={ideas} /> : null}
    </div>
  );
}
