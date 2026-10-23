import type { ChoiceProps } from "./field";
import { Messages } from "./field-messages";

interface CheckGroupProps<T extends string> extends ChoiceProps<T> {
  value: readonly T[];
  /** Gets the ticked values, always in the options' own order. */
  onValueChange: (value: T[]) => void;
}

/**
 * A checkbox group: any number of choices. The first box carries the group's
 * id, so an error summary link lands on something focusable, and every box
 * is tied to the error text.
 */
export function CheckGroup<T extends string>({
  id,
  legend,
  name,
  options,
  value,
  onValueChange,
  error,
  className,
}: Readonly<CheckGroupProps<T>>) {
  return (
    <fieldset className={`choices ${className ?? ""}`} id={`${id}-group`}>
      <legend>{legend}</legend>
      {options.map((option, index) => (
        <label key={option.value} className="choice">
          <input
            id={index === 0 ? id : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            type="checkbox"
            name={name}
            value={option.value}
            checked={value.includes(option.value)}
            onChange={(event) => {
              const next = event.target.checked
                ? [...value, option.value]
                : value.filter((ticked) => ticked !== option.value);
              onValueChange(
                options.map(({ value: own }) => own).filter((own) => next.includes(own)),
              );
            }}
          />
          <span className="choice-text choice-label">{option.label}</span>
        </label>
      ))}
      <Messages id={id} error={error} />
    </fieldset>
  );
}
