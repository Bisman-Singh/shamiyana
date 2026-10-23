"use client";

import { COMMUNITY_KINDS, HONOREES, WEDDING_FUNCTIONS } from "@/lib/plan/constants";
import { useLocale } from "@/components/locale-provider";
import { CheckGroup } from "@/components/ui/check-group";
import { RadioGroup } from "@/components/ui/radio-group";
import { options, type FieldsProps } from "./fields-props";

/** The one extra question each event type asks: functions, whose birthday, or what kind of event. */
export function VariantField({ draft, set, error, idOf }: Readonly<FieldsProps>) {
  const { dict } = useLocale();
  switch (draft.type) {
    case "wedding":
      return (
        <CheckGroup
          id={idOf("functions")}
          name="functions"
          legend={dict.form.functionsLegend}
          options={options(WEDDING_FUNCTIONS, dict.form.functions)}
          value={draft.functions}
          error={error("functions")}
          onValueChange={(value) => {
            set("functions", value);
          }}
          className="choices-wrap"
        />
      );
    case "birthday":
      return (
        <RadioGroup
          id={idOf("honoree")}
          name="honoree"
          legend={dict.form.honoreeLegend}
          options={options(HONOREES, dict.form.honorees)}
          value={draft.honoree}
          onValueChange={(value) => {
            set("honoree", value);
          }}
          className="choices-wrap"
        />
      );
    case "community":
      return (
        <RadioGroup
          id={idOf("kind")}
          name="kind"
          legend={dict.form.kindLegend}
          options={options(COMMUNITY_KINDS, dict.form.kinds)}
          value={draft.kind}
          onValueChange={(value) => {
            set("kind", value);
          }}
          className="choices-wrap"
        />
      );
  }
}
