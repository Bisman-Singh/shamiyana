import "server-only";
import { LEGAL, type LegalPage } from "@/lib/i18n/legal";
import { requestLocale } from "./locale";

/** A policy's words in the language of the request. */
export async function policyFor(kind: keyof typeof LEGAL): Promise<LegalPage> {
  return LEGAL[kind][(await requestLocale()).locale];
}
