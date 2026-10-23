import type { ReactNode } from "react";

/**
 * What every labelled control shares. Hint and error are tied to the control
 * with aria-describedby, and an error sets aria-invalid, so a screen reader
 * hears the label, the hint and what to fix together.
 */
export interface Described {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
}

/** One choice in a select or a group of radios or check boxes. */
export interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

/** What a radio or check box group shares: its legend, the input name and its options. */
export interface ChoiceProps<T extends string> {
  id: string;
  legend: string;
  name: string;
  options: readonly Option<T>[];
  error?: string;
  className?: string;
}

function describedBy(id: string, hint: ReactNode, error: string | undefined): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/** The hint and the error under a control, each with the id the control points at. */
export function Messages({ id, hint, error }: Readonly<Omit<Described, "label">>) {
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
export function Field({
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
export function controlProps({ id, hint, error }: Omit<Described, "label">) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy(id, hint, error),
  };
}
