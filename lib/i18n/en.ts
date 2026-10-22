import en from "./en.json";

/**
 * The English dictionary is the source of truth for keys. Hindi must match it key
 * for key, which the type checker enforces. Placeholders look like `{name}`;
 * plural forms are `{ one, other }` objects.
 */
type Widen<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : { readonly [K in keyof T]: Widen<T[K]> };

export type Dictionary = Widen<typeof en>;

const english: Dictionary = en;
export { english as en };
