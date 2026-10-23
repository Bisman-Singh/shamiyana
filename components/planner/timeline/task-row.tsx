"use client";

import { useId } from "react";
import { googleCalendarUrl } from "@/lib/export/links";
import { format, formatDate } from "@/lib/i18n/format";
import { langOf } from "@/lib/i18n/lang";
import { removeTask, toggleTask } from "@/lib/plan/record";
import type { TimelineItem } from "@/lib/plan/timeline";
import { useLocale } from "@/components/locale-provider";
import { areaName, taskTitle } from "@/components/planner/task-title";
import type { PlanView, Update } from "@/components/planner/types";
import { Template } from "@/components/ui/template";

interface TaskRowProps {
  item: TimelineItem;
  view: PlanView;
  update: Update;
}

/** One task: done or not, its due date, area and source, a calendar link and Remove. */
export function TaskRow({ item, view, update }: Readonly<TaskRowProps>) {
  const { dict, locale } = useLocale();
  const title = taskTitle(item, dict);
  const checkId = useId();
  return (
    <li className={item.done ? "task is-done" : "task"}>
      <div className="task-check">
        <input
          id={checkId}
          type="checkbox"
          checked={item.done}
          onChange={() => {
            update((record, now) => toggleTask(record, item.id, now));
          }}
        />
      </div>
      <div className="task-body">
        <label htmlFor={checkId} className="task-title">
          <span className="visually-hidden">{dict.timeline.donePrefix}</span>{" "}
          <span lang={langOf(title, locale)}>{title}</span>
        </label>
        <p className="task-meta">
          <span>{format(dict.timeline.by, { date: formatDate(item.due, locale) })}</span>
          <span>{areaName(item.area, dict)}</span>
          {item.late ? <span className="tag tag-late">{dict.timeline.overdue}</span> : null}
          {item.source === "template" ? null : (
            <span className="tag">{dict.timeline.sources[item.source]}</span>
          )}
        </p>
      </div>
      <div className="task-actions">
        <a
          className="btn btn-small btn-quiet"
          href={googleCalendarUrl(
            title,
            item.late ? view.today : item.due,
            view.record.brief.title,
          )}
          target="_blank"
          rel="noopener noreferrer"
        >
          {dict.timeline.calendar}{" "}
          <span className="visually-hidden">
            <span lang={langOf(title, locale)}>{title}</span> {dict.common.opensNewTab}
          </span>
        </a>
        <button
          type="button"
          className="btn btn-small btn-quiet"
          onClick={() => {
            update(
              (record, now) => removeTask(record, item.id, now),
              format(dict.timeline.removed, { title }),
            );
          }}
        >
          <Template
            text={dict.timeline.remove}
            values={{
              title: (
                <span className="visually-hidden" lang={langOf(title, locale)}>
                  {title}
                </span>
              ),
            }}
          />
        </button>
      </div>
    </li>
  );
}
