import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/legal-article";
import { policyFor } from "@/lib/server/policy";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await policyFor("privacy")).title };
}

/** The privacy policy, in the language of the request. */
export default async function PrivacyPage() {
  return <LegalArticle page={await policyFor("privacy")} />;
}
