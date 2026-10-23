"use client";

import { createContext, use, useMemo, type ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n/en";
import { formatMoney } from "@/lib/i18n/format";
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

/** The language and dictionary chosen on the server, for any client component. */
export function useLocale(): LocaleValue {
  const value = use(LocaleContext);
  if (!value) throw new Error("useLocale needs a LocaleProvider");
  return value;
}

/** Formats a rupee amount in the language of the page. */
export function useMoney(): (amount: number) => string {
  const { locale } = useLocale();
  return (amount) => formatMoney(amount, locale);
}
