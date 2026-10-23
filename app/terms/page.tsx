import type { Metadata } from "next";
import { LegalArticle } from "@/components/legal/legal-article";
import { policyFor } from "@/lib/server/policy";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await policyFor("terms")).title };
}

/** The terms policy, in the language of the request. */
export default async function TermsPage() {
  return <LegalArticle page={await policyFor("terms")} />;
}
