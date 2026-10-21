"use client";

import { useId, useState, type SubmitEvent } from "react";
import { buildIcs } from "@/lib/export/ics";
import { fileName, googleCalendarUrl } from "@/lib/export/links";
import { downloadText } from "@/lib/client/files";
import { format, formatDate, plural } from "@/lib/i18n/format";
import { CATEGORY_IDS, LIMITS, type TaskArea } from "@/lib/plan/constants";
import { daysBetween, isIsoDate } from "@/lib/plan/dates";
import { addTask, newId, removeTask, restoreHiddenTasks, toggleTask } from "@/lib/plan/record";
import { cleanText } from "@/lib/plan/text";
import { PHASES, type TimelineItem } from "@/lib/plan/timeline";
import { useLocale } from "../locale-provider";
import { SelectField, TextField } from "../ui/field";
import { areaName, taskTitle } from "./task-title";
import type { PlanView, Update } from "./types";

const AREAS: TaskArea[] = ["planning", ...CATEGORY_IDS];

function AddTask({ view, update }: { view: PlanView; update: Update }) {
  const { dict } = useLocale();
  const t = dict.timeline;
  const baseId = useId();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [area, setArea] = useState<TaskArea>("planning");
  const [errors, setErrors] = useState<{ title?: string; date?: string }>({});
  const { brief } = view.record;

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = cleanText(title);
    const lead = isIsoDate(date) ? daysBetween(date, brief.date) : -1;
    const next = {
      title: clean.length < 1 || clean.length > 120 ? t.addTitleError : undefined,
      date: lead < 0 || daysBetween(view.today, date) < 0 ? t.addDateError : undefined,
    };
    setErrors(next);
    if (next.title ?? next.date) return;
    update((r, now) => addTask(r, { title: clean, area, leadDays: lead }, newId(), now));
    setTitle("");
    setDate("");
  }

  if (view.record.tasks.length >= LIMITS.customTasksMax)
    return <p className="hint">{t.addLimit}</p>;
  return (
    <form className="add-task" onSubmit={submit} noValidate aria-labelledby={`${baseId}-h`}>
      <h3 id={`${baseId}-h`}>{t.addHeading}</h3>
      <div className="form-row">
        <TextField
          id={`${baseId}-title`}
          label={t.addTitle}
          value={title}
          maxLength={120}
          error={errors.title}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
        />
        <TextField
          id={`${baseId}-date`}
          label={t.addDate}
          type="date"
          value={date}
          min={view.today}
          max={brief.date}
          error={errors.date}
          onChange={(e) => {
            setDate(e.target.value);
          }}
        />
        <SelectField
          id={`${baseId}-area`}
          label={t.addArea}
          value={area}
          options={AREAS.map((a) => ({ value: a, label: areaName(a, dict) }))}
          onChange={(e) => {
            setArea(e.target.value as TaskArea);
          }}
        />
        <button type="submit" className="btn">
          {t.addSubmit}
        </button>
      </div>
    </form>
  );
}

function TaskRow({ item, view, update }: { item: TimelineItem; view: PlanView; update: Update }) {
  const { dict, locale } = useLocale();
  const t = dict.timeline;
  const title = taskTitle(item, dict);
  return (
    <li className={item.done ? "task is-done" : "task"}>
      <label className="task-check">
        <input
          type="checkbox"
          checked={item.done}
          onChange={() => {
            update((r, now) => toggleTask(r, item.id, now));
          }}
        />
        <span className="visually-hidden">{format(t.markDone, { title })}</span>
      </label>
      <div className="task-body">
        <p className="task-title" aria-hidden="true">
          {title}
        </p>
        <p className="task-meta">
          <span>{format(t.by, { date: formatDate(item.due, locale) })}</span>
          <span>{areaName(item.area, dict)}</span>
          {item.late ? <span className="tag tag-late">{t.overdue}</span> : null}
          {item.source === "template" ? null : (
            <span className="tag">{t.sources[item.source]}</span>
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
          {t.calendar} <span className="visually-hidden">{dict.common.opensNewTab}</span>
        </a>
        <button
          type="button"
          className="btn btn-small btn-quiet"
          aria-label={format(t.remove, { title })}
          onClick={() => {
            update((r, now) => removeTask(r, item.id, now), format(t.removed, { title }));
          }}
        >
          {dict.common.remove}
        </button>
      </div>
    </li>
  );
}

export function TimelinePanel({ view, update }: { view: PlanView; update: Update }) {
  const { dict, locale } = useLocale();
  const t = dict.timeline;
  const { timeline, record } = view;

  function downloadIcs() {
    const ics = buildIcs({
      planId: record.id,
      eventTitle: record.brief.title,
      eventDate: record.brief.date,
      city: record.brief.city,
      tasks: timeline.items
        .filter((i) => !i.done)
        .map((i) => ({ id: i.id, title: taskTitle(i, dict), due: i.due })),
      today: view.today,
      now: new Date(),
    });
    downloadText(fileName(record.brief.title, "ics"), "text/calendar;charset=utf-8", ics);
  }

  return (
    <div className="timeline">
      <div className="panel-head">
        <h2>{t.heading}</h2>
        <p className="hint">
          {format(t.progress, { done: timeline.doneCount, total: timeline.items.length })}
        </p>
        <button type="button" className="btn btn-quiet" onClick={downloadIcs}>
          {t.ics}
        </button>
      </div>
      {timeline.lateCount > 0 ? (
        <p className="notice-inline is-over">
          {plural(locale, t.overdueBanner, timeline.lateCount)}
        </p>
      ) : null}
      {PHASES.map((phase) => {
        const items = timeline.items.filter((i) => i.phase === phase);
        return items.length === 0 ? null : (
          <section key={phase} aria-labelledby={`phase-${phase}`} className="phase">
            <h3 id={`phase-${phase}`}>{t.phases[phase]}</h3>
            <ul className="task-list">
              {items.map((item) => (
                <TaskRow key={item.id} item={item} view={view} update={update} />
              ))}
            </ul>
          </section>
        );
      })}
      <p className="event-day">
        <strong>{t.eventDay}</strong> {formatDate(record.brief.date, locale, true)}
      </p>
      {record.hidden.length > 0 ? (
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            update((r, now) => restoreHiddenTasks(r, now));
          }}
        >
          {plural(locale, t.restore, record.hidden.length)}
        </button>
      ) : null}
      <AddTask view={view} update={update} />
    </div>
  );
}
