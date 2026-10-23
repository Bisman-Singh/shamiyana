import { Fragment, type ReactNode } from "react";

interface TemplateProps {
  /** A message with {placeholders}, such as "Remove {title}". */
  text: string;
  values: Readonly<Record<string, ReactNode>>;
}

/**
 * A message whose placeholders are filled with nodes rather than text, so a
 * typed title or an English phrase inside a Hindi sentence can carry its own
 * `lang`, and word order still follows each language's dictionary.
 */
export function Template({ text, values }: Readonly<TemplateProps>) {
  // splitting on a captured group puts each placeholder name at an odd index
  const parts = text.split(/\{(\w+)\}/);
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 0 ? part : <Fragment key={part}>{values[part] ?? `{${part}}`}</Fragment>,
      )}
    </>
  );
}
