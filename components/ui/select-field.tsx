import type { SelectHTMLAttributes } from "react";
import { oneOf } from "@/lib/shared/untrusted";
import { controlProps, Field, type Described, type Option } from "./field";

type SelectFieldProps<T extends string> = Described & {
  options: readonly Option<T>[];
  value: T;
  /** Gets the chosen option's value; anything outside the options is ignored. */
  onValueChange: (value: T) => void;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "defaultValue" | "onChange">;

/** A labelled select that only reports values from its own options. */
export function SelectField<T extends string>({
  id,
  label,
  hint,
  error,
  options,
  value,
  onValueChange,
  ...select
}: Readonly<SelectFieldProps<T>>) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <select
        {...controlProps({ id, hint, error })}
        value={value}
        onChange={(event) => {
          const chosen = oneOf(
            event.target.value,
            options.map((option) => option.value),
          );
          if (chosen !== null) onValueChange(chosen);
        }}
        {...select}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
