import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/en";
import { BrandMark, ScallopRule } from "./brand-mark";
import { LanguageSwitch } from "./language-switch";

interface SiteHeaderProps {
  dict: Dictionary;
}

/** Brand and the language switch. */
export function SiteHeader({ dict }: Readonly<SiteHeaderProps>) {
  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Link href="/" className="brand">
          <BrandMark />
          <span className="brand-text">
            <span className="brand-name">{dict.brand.name}</span>
            <span className="brand-tagline">{dict.brand.tagline}</span>
          </span>
        </Link>
        <LanguageSwitch />
      </div>
      <ScallopRule />
    </header>
  );
}

interface SiteFooterProps {
  dict: Dictionary;
}

/** The AI and storage notes, and links to the policies. */
export function SiteFooter({ dict }: Readonly<SiteFooterProps>) {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <p>{dict.footer.ai}</p>
        <p>{dict.footer.local}</p>
        <nav aria-label={dict.footer.legal}>
          <ul className="inline-list">
            <li>
              <Link href="/privacy">{dict.footer.privacy}</Link>
            </li>
            <li>
              <Link href="/terms">{dict.footer.terms}</Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
