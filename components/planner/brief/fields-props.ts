import type { Draft, DraftField } from "@/lib/plan/draft";
import type { Option } from "@/components/ui/field";

/** What every group of brief fields gets from the form. */
export interface FieldsProps {
  draft: Draft;
  set: <K extends keyof Draft>(key: K, value: Draft[K]) => void;
  error: (field: DraftField) => string | undefined;
  idOf: (name: string) => string;
}

/** Options for a choice group from its values, their labels and, for some, a hint each. */
export function options<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
  hints?: Record<T, string>,
): Option<T>[] {
  return values.map((value) =>
    hints ? { value, label: labels[value], hint: hints[value] } : { value, label: labels[value] },
  );
}
