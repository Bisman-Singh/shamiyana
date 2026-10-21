import type { Metadata } from "next";
import Link from "next/link";
import { requestLocale } from "@/lib/server/locale";

export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await requestLocale();
  return { title: dict.notFound.heading };
}

export default async function NotFound() {
  const { dict } = await requestLocale();
  return (
    <div className="page-message">
      <h1>{dict.notFound.heading}</h1>
      <p>{dict.notFound.body}</p>
      <Link href="/" className="btn btn-primary">
        {dict.notFound.home}
      </Link>
    </div>
  );
}
