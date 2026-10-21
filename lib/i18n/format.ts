import type { Locale } from "@/lib/plan/constants";
import type { Dictionary } from "./en";

/**
 * Formatting helpers with no dictionary inside, so client components can use
 * them without bundling every language. The active dictionary arrives from
 * the server as a prop.
 */

export const LOCALE_COOKIE = "lang";

export function intlLocale(locale: Locale): string {
  return locale === "hi" ? "hi-IN" : "en-IN";
}

/** Fills `{key}` placeholders; unknown keys are left as written. */
export function format(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

export interface PluralForms {
  one: string;
  other: string;
}

export function plural(
  locale: Locale,
  forms: PluralForms,
  n: number,
  values: Record<string, string | number> = {},
): string {
  const form =
    new Intl.PluralRules(intlLocale(locale)).select(n) === "one" ? forms.one : forms.other;
  return format(form, { n: formatNumber(n, locale), ...values });
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(n);
}

export function formatMoney(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** An ISO calendar date shown the way the user reads dates, never shifted by time zone. */
export function formatDate(iso: string, locale: Locale, long = false): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: long ? "long" : "short",
    year: "numeric",
    weekday: long ? "long" : undefined,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Rupees in the words Indians budget in: thousand, lakh, crore. */
export function amountInWords(amount: number, dict: Dictionary, locale: Locale): string {
  const short = (n: number) =>
    new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 }).format(n);
  if (amount >= 1_00_00_000) return format(dict.units.crore, { n: short(amount / 1_00_00_000) });
  if (amount >= 1_00_000) return format(dict.units.lakh, { n: short(amount / 1_00_000) });
  if (amount >= 1_000) return format(dict.units.thousand, { n: short(amount / 1_000) });
  return formatMoney(amount, locale);
}
