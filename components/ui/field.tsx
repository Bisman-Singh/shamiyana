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
  error?: string;
}

function describedBy(id: string, hint: unknown, error: unknown): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function Messages({ id, hint, error }: Readonly<Omit<Described, "label">>) {
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

/** The label, the control and its messages, tied together by the control's id. */
function Field({
  id,
  label,
  hint,
  error,
  children,
}: Readonly<Described & { children: ReactNode }>) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      <Messages id={id} hint={hint} error={error} />
    </div>
  );
}

/** The attributes that point a control at its hint and error. */
function controlProps({ id, hint, error }: Omit<Described, "label">) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy(id, hint, error),
  };
}

/** A labelled text input with its hint and error. */
export function TextField({
  id,
  label,
  hint,
  error,
  ...input
}: Described & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input {...controlProps({ id, hint, error })} {...input} />
    </Field>
  );
}

/** A labelled text area with its hint and error. */
export function TextArea({
  id,
  label,
  hint,
  error,
  ...input
}: Described & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <textarea {...controlProps({ id, hint, error })} {...input} />
    </Field>
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
}: SelectProps<T>) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <select
        {...controlProps({ id, hint, error })}
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
    </Field>
  );
}

interface ChoiceProps<T extends string> {
  id: string;
  legend: string;
  name: string;
  options: readonly Option<T>[];
  error?: string;
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
          <span className="choice-text choice-label">{o.label}</span>
        </label>
      ))}
      <Messages id={id} error={error} />
    </fieldset>
  );
}
