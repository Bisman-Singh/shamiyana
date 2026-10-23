"use client";

import { EVENT_TYPES, type EventType } from "@/lib/plan/constants";
import { useLocale } from "@/components/locale-provider";
import { RadioGroup } from "@/components/ui/radio-group";
import { options, type FieldsProps } from "./fields-props";

/** The event type choice, which decides the extra fields below it. */
export function EventTypeField({ draft, set, idOf }: Readonly<FieldsProps>) {
  const { dict } = useLocale();
  return (
    <RadioGroup<EventType>
      id={idOf("type")}
      name="type"
      legend={dict.form.typeLegend}
      options={options(EVENT_TYPES, dict.form.types, dict.form.typeHints)}
      value={draft.type}
      onValueChange={(value) => {
        set("type", value);
      }}
      className="choices-stacked"
    />
  );
}
