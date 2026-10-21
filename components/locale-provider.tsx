"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n/en";
import type { Locale } from "@/lib/plan/constants";

interface LocaleValue {
  locale: Locale;
  dict: Dictionary;
}

const LocaleContext = createContext<LocaleValue | null>(null);

/** Holds the one dictionary the server picked for this request. */
export function LocaleProvider({ locale, dict, children }: LocaleValue & { children: ReactNode }) {
  const value = useMemo(() => ({ locale, dict }), [locale, dict]);
  return <LocaleContext value={value}>{children}</LocaleContext>;
}

export function useLocale(): LocaleValue {
  const value = use(LocaleContext);
  if (!value) throw new Error("useLocale needs a LocaleProvider");
  return value;
}
