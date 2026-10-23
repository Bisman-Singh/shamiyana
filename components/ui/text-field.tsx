import type { InputHTMLAttributes } from "react";
import { controlProps, Field, type Described } from "./field";

type TextFieldProps = Described & InputHTMLAttributes<HTMLInputElement>;

/** A labelled text input with its hint and error. */
export function TextField({ id, label, hint, error, ...input }: Readonly<TextFieldProps>) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input {...controlProps({ id, hint, error })} {...input} />
    </Field>
  );
}
