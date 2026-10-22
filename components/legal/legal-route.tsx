import type { Metadata } from "next";
import { LEGAL } from "@/lib/i18n/legal";
import { requestLocale } from "@/lib/server/locale";
import { LegalArticle } from "./legal-page";

/** The metadata and the page for one policy, in the language of the request. */
export function legalRoute(kind: keyof typeof LEGAL) {
  const content = async () => LEGAL[kind][(await requestLocale()).locale];
  return {
    generateMetadata: async (): Promise<Metadata> => ({ title: (await content()).title }),
    Page: async () => <LegalArticle page={await content()} />,
  };
}
