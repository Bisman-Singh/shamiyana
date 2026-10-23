import type { TextareaHTMLAttributes } from "react";
import { controlProps, Field, type Described } from "./field";

type TextAreaProps = Described & TextareaHTMLAttributes<HTMLTextAreaElement>;

/** A labelled text area with its hint and error. */
export function TextArea({ id, label, hint, error, ...input }: Readonly<TextAreaProps>) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <textarea {...controlProps({ id, hint, error })} {...input} />
    </Field>
  );
}
