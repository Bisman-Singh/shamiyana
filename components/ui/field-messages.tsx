import type { ReactNode } from "react";

interface FieldMessagesProps {
  id: string;
  hint?: ReactNode;
  error?: string;
}

/** The hint and the error under a control, each with the id the control points at. */
export function Messages({ id, hint, error }: Readonly<FieldMessagesProps>) {
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
