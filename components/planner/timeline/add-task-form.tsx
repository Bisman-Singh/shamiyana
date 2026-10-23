"use client";

import { useId, useState, type SubmitEvent } from "react";
import { format } from "@/lib/i18n/format";
import { LIMITS, TASK_AREAS, type TaskArea } from "@/lib/plan/constants";
import { addTask } from "@/lib/plan/record";
import { newId } from "@/lib/shared/ids";
import { parseNewTask } from "@/lib/plan/timeline";
import { useLocale } from "@/components/locale-provider";
import { useAnnounce } from "@/components/ui/announcer";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import { focusAfterRender } from "@/components/ui/focus";
import { areaName } from "@/components/planner/task-title";
import type { PanelProps } from "@/components/planner/types";

/** Adds a task of the user's own; a field that needs fixing says so and takes focus. */
export function AddTaskForm({ view, update }: Readonly<PanelProps>) {
  const { dict } = useLocale();
  const baseId = useId();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [area, setArea] = useState<TaskArea>("planning");
  const [invalid, setInvalid] = useState<readonly ("title" | "date")[]>([]);
  const announce = useAnnounce();
  const { brief } = view.record;

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseNewTask(title, date, view.today, brief.date);
    setInvalid(parsed.ok ? [] : parsed.invalid);
    if (!parsed.ok) {
      focusAfterRender(`${baseId}-${parsed.invalid.includes("title") ? "title" : "date"}`);
      return;
    }
    const { task } = parsed;
    update((record, now) => addTask(record, { ...task, area }, newId(), now));
    announce(format(dict.timeline.added, { title: task.title }));
    setTitle("");
    setDate("");
    focusAfterRender(`${baseId}-title`);
  }

  if (view.record.tasks.length >= LIMITS.customTasksMax) {
    return <p className="hint">{dict.timeline.addLimit}</p>;
  }
  return (
    <form className="add-task" onSubmit={submit} noValidate aria-labelledby={`${baseId}-h`}>
      <h3 id={`${baseId}-h`}>{dict.timeline.addHeading}</h3>
      <div className="form-row">
        <TextField
          id={`${baseId}-title`}
          label={dict.timeline.addTitle}
          value={title}
          maxLength={LIMITS.taskTitleMax}
          error={invalid.includes("title") ? dict.timeline.addTitleError : undefined}
          onChange={(event) => {
            setTitle(event.target.value);
          }}
        />
        <TextField
          id={`${baseId}-date`}
          label={dict.timeline.addDate}
          type="date"
          value={date}
          min={view.today}
          max={brief.date}
          error={invalid.includes("date") ? dict.timeline.addDateError : undefined}
          onChange={(event) => {
            setDate(event.target.value);
          }}
        />
        <SelectField
          id={`${baseId}-area`}
          label={dict.timeline.addArea}
          value={area}
          options={TASK_AREAS.map((value) => ({ value, label: areaName(value, dict) }))}
          onValueChange={setArea}
        />
        <button type="submit" className="btn">
          {dict.timeline.addSubmit}
        </button>
      </div>
    </form>
  );
}
