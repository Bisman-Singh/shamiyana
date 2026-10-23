import { LOCALES, type Locale } from "@/lib/plan/constants";
import { en, type Dictionary } from "./en";
import { hi } from "./hi";

export type { Dictionary };
export * from "./format";

const DICTIONARIES: Record<Locale, Dictionary> = { en, hi };

/** The dictionary for a language. */
export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

/** Whether a value is a supported language. */
export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((l) => l === value);
}

/** The saved choice first, then the browser's preference, then English. */
export function resolveLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookie)) return cookie;
  const first = acceptLanguage?.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("hi") ? "hi" : "en";
}
