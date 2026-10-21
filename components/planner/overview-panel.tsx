"use client";

import { format, formatDate, formatMoney, formatNumber } from "@/lib/i18n/format";
import type { Enrichment } from "@/lib/plan/enrichment";
import { vendorTally } from "@/lib/plan/vendors";
import { useLocale } from "../locale-provider";
import { taskTitle } from "./task-title";
import type { PlanView } from "./types";

export function OverviewPanel({ view, ideas }: { view: PlanView; ideas: Enrichment | null }) {
  const { dict, locale } = useLocale();
  const o = dict.overview;
  const { budget, timeline, guests } = view;
  const tally = vendorTally(view.vendors);
  const open = timeline.items
    .filter((i) => !i.done)
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 5);
  const n = (value: number) => formatNumber(value, locale);

  return (
    <div className="overview">
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
          <dd className={timeline.lateCount > 0 ? "is-over" : undefined}>
            {n(timeline.lateCount)}
          </dd>
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

      <section aria-labelledby="next-up">
        <h2 id="next-up">{o.next}</h2>
        {open.length === 0 ? (
          <p>{o.allDone}</p>
        ) : (
          <ol className="next-list">
            {open.map((item) => (
              <li key={item.id}>
                <span>{taskTitle(item, dict)}</span>{" "}
                <span className={item.late ? "tag tag-late" : "tag"}>
                  {item.late
                    ? dict.timeline.overdue
                    : format(dict.timeline.by, { date: formatDate(item.due, locale) })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {ideas && ideas.theme.name !== "" ? (
        <section aria-labelledby="theme">
          <h2 id="theme">{o.theme}</h2>
          <p className="theme-name">{ideas.theme.name}</p>
          <p>{ideas.theme.summary}</p>
        </section>
      ) : null}

      {ideas && ideas.risks.length > 0 ? (
        <section aria-labelledby="risks">
          <h2 id="risks">{o.risks}</h2>
          <ul className="plain-list">
            {ideas.risks.map((r) => (
              <li key={r.risk}>
                <strong>{r.risk}</strong> {r.mitigation}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
