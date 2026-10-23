import type { Metadata } from "next";
import Link from "next/link";
import { requestLocale } from "@/lib/server/locale";

/** Titles the 404 page in the visitor's language. */
export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await requestLocale();
  return { title: dict.notFound.heading };
}

/** The 404 page, with a way back to the planner. */
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
