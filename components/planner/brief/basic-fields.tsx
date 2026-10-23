"use client";

import { amountInWords, format } from "@/lib/i18n/format";
import { readAmount } from "@/lib/plan/amounts";
import { LIMITS } from "@/lib/plan/constants";
import { addDays } from "@/lib/plan/dates";
import { useLocale } from "@/components/locale-provider";
import { TextField } from "@/components/ui/text-field";
import type { FieldsProps } from "./fields-props";

interface BasicFieldsProps extends FieldsProps {
  /** The earliest date the event can take. */
  today: string;
}

/** Name, date, city, guests and budget; the budget hint says the amount in words. */
export function BasicFields({ draft, set, error, idOf, today }: Readonly<BasicFieldsProps>) {
  const { dict, locale } = useLocale();
  const amount = readAmount(draft.budget);
  const words =
    amount !== null && amount > 0
      ? format(dict.form.budgetWords, { amount: amountInWords(amount, dict, locale) })
      : undefined;
  return (
    <div className="form-grid">
      <TextField
        id={idOf("title")}
        label={dict.form.title}
        hint={dict.form.titleHint}
        error={error("title")}
        value={draft.title}
        maxLength={LIMITS.titleMax}
        autoComplete="off"
        required
        onChange={(event) => {
          set("title", event.target.value);
        }}
      />
      <TextField
        id={idOf("date")}
        label={dict.form.date}
        error={error("date")}
        type="date"
        value={draft.date}
        min={today}
        max={addDays(today, LIMITS.maxDaysAhead)}
        required
        onChange={(event) => {
          set("date", event.target.value);
        }}
      />
      <TextField
        id={idOf("city")}
        label={dict.form.city}
        error={error("city")}
        value={draft.city}
        maxLength={LIMITS.cityMax}
        autoComplete="address-level2"
        required
        onChange={(event) => {
          set("city", event.target.value);
        }}
      />
      <TextField
        id={idOf("guests")}
        label={dict.form.guests}
        hint={dict.form.guestsHint}
        error={error("guests")}
        value={draft.guests}
        inputMode="numeric"
        autoComplete="off"
        required
        onChange={(event) => {
          set("guests", event.target.value);
        }}
      />
      <TextField
        id={idOf("budget")}
        label={dict.form.budget}
        hint={words}
        error={error("budget")}
        value={draft.budget}
        inputMode="numeric"
        autoComplete="off"
        required
        onChange={(event) => {
          set("budget", event.target.value);
        }}
      />
    </div>
  );
}
