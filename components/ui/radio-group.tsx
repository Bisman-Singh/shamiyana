import type { ChoiceProps } from "./field";

interface RadioGroupProps<T extends string> extends ChoiceProps<T> {
  value: T;
  onValueChange: (value: T) => void;
}

/** A radio group: one choice, each with an optional hint under its label. */
export function RadioGroup<T extends string>({
  id,
  legend,
  name,
  options,
  value,
  onValueChange,
  className,
}: Readonly<RadioGroupProps<T>>) {
  return (
    <fieldset className={`choices ${className ?? ""}`} id={id}>
      <legend>{legend}</legend>
      {options.map((option) => (
        <label key={option.value} className="choice">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => {
              onValueChange(option.value);
            }}
          />
          <span className="choice-text">
            <span className="choice-label">{option.label}</span>
            {option.hint ? <span className="choice-hint">{option.hint}</span> : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
