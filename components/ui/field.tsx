import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { oneOf } from "@/lib/plan/loose";

/**
 * Labelled form controls. Hint and error are tied to the control with
 * aria-describedby, and an error sets aria-invalid, so a screen reader hears
 * the label, the hint and what to fix together.
 */

interface Described {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
}

function describedBy(id: string, hint: unknown, error: unknown): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function Messages({ id, hint, error }: Omit<Described, "label">) {
  return (
    <>
      {hint ? (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : null}
    </>
  );
}

export function TextField({
  id,
  label,
  hint,
  error,
  ...input
}: Described & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...input}
      />
      <Messages id={id} hint={hint} error={error} />
    </div>
  );
}

export function TextArea({
  id,
  label,
  hint,
  error,
  ...input
}: Described & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...input}
      />
      <Messages id={id} hint={hint} error={error} />
    </div>
  );
}

export interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

type SelectProps<T extends string> = Described & {
  options: readonly Option<T>[];
  value: T;
  /** Gets the chosen option's value; anything outside the options is ignored. */
  onValueChange: (value: T) => void;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "value" | "defaultValue" | "onChange">;

export function SelectField<T extends string>({
  id,
  label,
  hint,
  error,
  options,
  value,
  onValueChange,
  ...select
}: SelectProps<T>) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        value={value}
        onChange={(e) => {
          const chosen = oneOf(
            e.target.value,
            options.map((o) => o.value),
          );
          if (chosen !== null) onValueChange(chosen);
        }}
        {...select}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Messages id={id} hint={hint} error={error} />
    </div>
  );
}

interface ChoiceProps<T extends string> {
  id: string;
  legend: string;
  name: string;
  options: readonly Option<T>[];
  error?: string | undefined;
  className?: string;
}

/** A radio group: one choice. */
export function RadioGroup<T extends string>({
  id,
  legend,
  name,
  options,
  value,
  onChange,
  className,
}: ChoiceProps<T> & { value: T; onChange: (value: T) => void }) {
  return (
    <fieldset className={`choices ${className ?? ""}`} id={id}>
      <legend>{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className="choice">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => {
              onChange(o.value);
            }}
          />
          <span className="choice-text">
            <span className="choice-label">{o.label}</span>
            {o.hint ? <span className="choice-hint">{o.hint}</span> : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
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
  onChange,
  error,
  className,
}: ChoiceProps<T> & { value: readonly T[]; onChange: (value: T[]) => void }) {
  return (
    <fieldset className={`choices ${className ?? ""}`} id={`${id}-group`}>
      <legend>{legend}</legend>
      {options.map((o, index) => (
        <label key={o.value} className="choice">
          <input
            id={index === 0 ? id : undefined}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            type="checkbox"
            name={name}
            value={o.value}
            checked={value.includes(o.value)}
            onChange={(event) => {
              const next = event.target.checked
                ? [...value, o.value]
                : value.filter((v) => v !== o.value);
              onChange(options.map((opt) => opt.value).filter((v) => next.includes(v)));
            }}
          />
          <span className="choice-text">
            <span className="choice-label">{o.label}</span>
          </span>
        </label>
      ))}
      <Messages id={id} error={error} />
    </fieldset>
  );
}
