import Link from "next/link";
import type { Dictionary } from "@/lib/i18n/en";
import { BrandMark } from "./brand-mark";
import { LanguageSwitch } from "./language-switch";

/** A thin row of scallops, the edge of a tent, used under the header. */
function ScallopRule() {
  return (
    <svg className="scallop-rule" width="100%" height="10" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="scallop" width="20" height="10" patternUnits="userSpaceOnUse">
          <path d="M0 1 q5 8 10 0 q5 8 10 0" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </pattern>
      </defs>
      <rect width="100%" height="10" fill="url(#scallop)" />
    </svg>
  );
}

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
