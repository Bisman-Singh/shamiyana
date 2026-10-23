"use client";

import { format } from "@/lib/i18n/format";
import { FOOD_PREFS, LIMITS, STYLES } from "@/lib/plan/constants";
import { useLocale } from "@/components/locale-provider";
import { RadioGroup } from "@/components/ui/radio-group";
import { TextArea } from "@/components/ui/text-area";
import { options, type FieldsProps } from "./fields-props";

/** Style, food preference and free notes for the AI. */
export function PreferenceFields({ draft, set, error, idOf }: Readonly<FieldsProps>) {
  const { dict } = useLocale();
  return (
    <>
      <RadioGroup
        id={idOf("style")}
        name="style"
        legend={dict.form.styleLegend}
        options={options(STYLES, dict.form.styles)}
        value={draft.style}
        onValueChange={(value) => {
          set("style", value);
        }}
        className="choices-wrap"
      />
      <RadioGroup
        id={idOf("food")}
        name="food"
        legend={dict.form.foodLegend}
        options={options(FOOD_PREFS, dict.form.foods)}
        value={draft.food}
        onValueChange={(value) => {
          set("food", value);
        }}
        className="choices-wrap"
      />
      <TextArea
        id={idOf("notes")}
        label={dict.form.notes}
        hint={`${dict.form.notesHint} ${format(dict.form.notesCount, { n: draft.notes.length, max: LIMITS.notesMax })}`}
        error={error("notes")}
        value={draft.notes}
        rows={3}
        maxLength={LIMITS.notesMax}
        onChange={(event) => {
          set("notes", event.target.value);
        }}
      />
    </>
  );
}
