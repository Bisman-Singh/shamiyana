import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/en";

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
