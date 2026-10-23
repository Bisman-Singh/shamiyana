import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { LocaleProvider } from "@/components/locale-provider";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { AnnouncerProvider } from "@/components/ui/announcer";
import { requestLocale } from "@/lib/server/locale";
import "./globals.css";

/** The site title in the visitor's language, with each page's title in front. */
export async function generateMetadata(): Promise<Metadata> {
  const { dict } = await requestLocale();
  return {
    title: { default: dict.meta.title, template: `%s · ${dict.brand.name}` },
    description: dict.meta.description,
    applicationName: dict.brand.name,
    openGraph: { title: dict.meta.title, description: dict.meta.description, type: "website" },
  };
}

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5efe3" },
    { media: "(prefers-color-scheme: dark)", color: "#101528" },
  ],
};

/** The page shell: html lang, skip link, header, main and footer in the visitor's language. */
export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const { locale, dict } = await requestLocale();
  return (
    <html lang={locale}>
      <body>
        <a href="#main" className="skip-link">
          {dict.nav.skip}
        </a>
        <LocaleProvider locale={locale} dict={dict}>
          <AnnouncerProvider>
            <SiteHeader dict={dict} />
            <main id="main" tabIndex={-1} className="wrap">
              {children}
            </main>
            <SiteFooter dict={dict} />
          </AnnouncerProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
