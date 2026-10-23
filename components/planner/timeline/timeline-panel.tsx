"use client";

import { useId } from "react";
import { downloadText } from "@/lib/client/files";
import { buildIcs } from "@/lib/export/ics";
import { fileName } from "@/lib/export/links";
import { format, formatDate, plural } from "@/lib/i18n/format";
import { restoreHiddenTasks } from "@/lib/plan/record";
import { PHASES } from "@/lib/plan/timeline";
import { useLocale } from "@/components/locale-provider";
import { taskTitle } from "@/components/planner/task-title";
import type { PanelProps } from "@/components/planner/types";
import { useAnnounce } from "@/components/ui/announcer";
import { focusOpenPanel } from "@/components/ui/focus";
import { AddTaskForm } from "./add-task-form";
import { TaskRow } from "./task-row";

/** Tasks by phase with due dates, calendar export, removed tasks and a form to add one. */
export function TimelinePanel({ view, update }: Readonly<PanelProps>) {
  const { dict, locale } = useLocale();
  const announce = useAnnounce();
  const baseId = useId();
  const { timeline, record } = view;

  function downloadIcs() {
    const ics = buildIcs({
      planId: record.id,
      eventTitle: record.brief.title,
      eventDate: record.brief.date,
      city: record.brief.city,
      tasks: timeline.items
        .filter((item) => !item.done)
        .map((item) => ({ id: item.id, title: taskTitle(item, dict), due: item.due })),
      today: view.today,
      now: new Date(),
    });
    downloadText(fileName(record.brief.title, "ics"), "text/calendar;charset=utf-8", ics);
  }

  return (
    <div className="timeline">
      <div className="panel-head">
        <h2>{dict.timeline.heading}</h2>
        <p className="hint">
          {format(dict.timeline.progress, {
            done: timeline.doneCount,
            total: timeline.items.length,
          })}
        </p>
        <button type="button" className="btn btn-quiet" onClick={downloadIcs}>
          {dict.timeline.ics}
        </button>
      </div>
      {timeline.lateCount > 0 ? (
        <p className="notice-inline is-over">
          {plural(locale, dict.timeline.overdueBanner, timeline.lateCount)}
        </p>
      ) : null}
      {PHASES.map((phase) => {
        const items = timeline.items.filter((item) => item.phase === phase);
        return items.length === 0 ? null : (
          <section key={phase} aria-labelledby={`${baseId}-${phase}`} className="phase">
            <h3 id={`${baseId}-${phase}`}>{dict.timeline.phases[phase]}</h3>
            <ul className="task-list">
              {items.map((item) => (
                <TaskRow key={item.id} item={item} view={view} update={update} />
              ))}
            </ul>
          </section>
        );
      })}
      <p className="event-day">
        <strong>{dict.timeline.eventDay}</strong> {formatDate(record.brief.date, locale, true)}
      </p>
      {record.hidden.length > 0 ? (
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            update((current, now) => restoreHiddenTasks(current, now));
            announce(plural(locale, dict.timeline.restored, record.hidden.length));
            focusOpenPanel();
          }}
        >
          {plural(locale, dict.timeline.restore, record.hidden.length)}
        </button>
      ) : null}
      <AddTaskForm view={view} update={update} />
    </div>
  );
}
