"use client";

import { amountInWords, format } from "@/lib/i18n/format";
import {
  COMMUNITY_KINDS,
  EVENT_TYPES,
  FOOD_PREFS,
  HONOREES,
  LIMITS,
  STYLES,
  WEDDING_FUNCTIONS,
  type EventType,
} from "@/lib/plan/constants";
import { addDays } from "@/lib/plan/dates";
import { readAmount, type Draft, type DraftField } from "@/lib/plan/draft";
import { useLocale } from "../locale-provider";
import { CheckGroup, RadioGroup, TextArea, TextField, type Option } from "../ui/field";

export interface FieldsProps {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  error: (field: DraftField) => string | undefined;
  idOf: (name: string) => string;
}

function options<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
  hints?: Record<T, string>,
): Option<T>[] {
  return values.map((value) =>
    hints ? { value, label: labels[value], hint: hints[value] } : { value, label: labels[value] },
  );
}

export function EventTypeField({ draft, set, idOf }: Readonly<FieldsProps>) {
  const { dict } = useLocale();
  const f = dict.form;
  return (
    <RadioGroup<EventType>
      id={idOf("type")}
      name="type"
      legend={f.typeLegend}
      options={options(EVENT_TYPES, f.types, f.typeHints)}
      value={draft.type}
      onChange={(v) => {
        set("type", v);
      }}
      className="choices-stacked"
    />
  );
}

export function BasicFields({ draft, set, error, idOf, today }: FieldsProps & { today: string }) {
  const { dict, locale } = useLocale();
  const f = dict.form;
  const amount = readAmount(draft.budget);
  const words =
    amount !== null && amount > 0
      ? format(f.budgetWords, { amount: amountInWords(amount, dict, locale) })
      : undefined;
  return (
    <div className="form-grid">
      <TextField
        id={idOf("title")}
        label={f.title}
        hint={f.titleHint}
        error={error("title")}
        value={draft.title}
        maxLength={LIMITS.titleMax}
        autoComplete="off"
        required
        onChange={(e) => {
          set("title", e.target.value);
        }}
      />
      <TextField
        id={idOf("date")}
        label={f.date}
        error={error("date")}
        type="date"
        value={draft.date}
        min={today}
        max={addDays(today, LIMITS.maxDaysAhead)}
        required
        onChange={(e) => {
          set("date", e.target.value);
        }}
      />
      <TextField
        id={idOf("city")}
        label={f.city}
        error={error("city")}
        value={draft.city}
        maxLength={LIMITS.cityMax}
        autoComplete="address-level2"
        required
        onChange={(e) => {
          set("city", e.target.value);
        }}
      />
      <TextField
        id={idOf("guests")}
        label={f.guests}
        hint={f.guestsHint}
        error={error("guests")}
        value={draft.guests}
        inputMode="numeric"
        autoComplete="off"
        required
        onChange={(e) => {
          set("guests", e.target.value);
        }}
      />
      <TextField
        id={idOf("budget")}
        label={f.budget}
        hint={words}
        error={error("budget")}
        value={draft.budget}
        inputMode="numeric"
        autoComplete="off"
        required
        onChange={(e) => {
          set("budget", e.target.value);
        }}
      />
    </div>
  );
}

/** The one extra question each event type asks: functions, whose birthday, or what kind of event. */
export function VariantField({ draft, set, error, idOf }: Readonly<FieldsProps>) {
  const { dict } = useLocale();
  const f = dict.form;
  switch (draft.type) {
    case "wedding":
      return (
        <CheckGroup
          id={idOf("functions")}
          name="functions"
          legend={f.functionsLegend}
          options={options(WEDDING_FUNCTIONS, f.functions)}
          value={draft.functions}
          error={error("functions")}
          onChange={(v) => {
            set("functions", v);
          }}
          className="choices-wrap"
        />
      );
    case "birthday":
      return (
        <RadioGroup
          id={idOf("honoree")}
          name="honoree"
          legend={f.honoreeLegend}
          options={options(HONOREES, f.honorees)}
          value={draft.honoree}
          onChange={(v) => {
            set("honoree", v);
          }}
          className="choices-wrap"
        />
      );
    case "community":
      return (
        <RadioGroup
          id={idOf("kind")}
          name="kind"
          legend={f.kindLegend}
          options={options(COMMUNITY_KINDS, f.kinds)}
          value={draft.kind}
          onChange={(v) => {
            set("kind", v);
          }}
          className="choices-wrap"
        />
      );
  }
}

export function PreferenceFields({ draft, set, error, idOf }: Readonly<FieldsProps>) {
  const { dict } = useLocale();
  const f = dict.form;
  return (
    <>
      <RadioGroup
        id={idOf("style")}
        name="style"
        legend={f.styleLegend}
        options={options(STYLES, f.styles)}
        value={draft.style}
        onChange={(v) => {
          set("style", v);
        }}
        className="choices-wrap"
      />
      <RadioGroup
        id={idOf("food")}
        name="food"
        legend={f.foodLegend}
        options={options(FOOD_PREFS, f.foods)}
        value={draft.food}
        onChange={(v) => {
          set("food", v);
        }}
        className="choices-wrap"
      />
      <TextArea
        id={idOf("notes")}
        label={f.notes}
        hint={`${f.notesHint} ${format(f.notesCount, { n: draft.notes.length, max: LIMITS.notesMax })}`}
        error={error("notes")}
        value={draft.notes}
        rows={3}
        maxLength={LIMITS.notesMax}
        onChange={(e) => {
          set("notes", e.target.value);
        }}
      />
    </>
  );
}
