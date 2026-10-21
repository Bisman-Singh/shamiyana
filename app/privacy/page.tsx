import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/i18n/legal";
import { requestLocale } from "@/lib/server/locale";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await requestLocale();
  return { title: LEGAL.privacy[locale].title };
}

export default async function PrivacyPage() {
  const { locale } = await requestLocale();
  return <LegalArticle page={LEGAL.privacy[locale]} />;
}
