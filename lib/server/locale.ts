import "server-only";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, getDictionary, resolveLocale, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/plan/constants";

/** The request's language from the saved cookie or the browser's Accept-Language. */
export async function requestLocale(): Promise<{ locale: Locale; dict: Dictionary }> {
  const [jar, list] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale(jar.get(LOCALE_COOKIE)?.value, list.get("accept-language"));
  return { locale, dict: getDictionary(locale) };
}
