"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALE_COOKIE } from "@/lib/i18n/lang";
import { useLocale } from "./locale-provider";

/** Switches language by cookie and re-renders on the server, so the page arrives translated. */
export function LanguageSwitch() {
  const { locale, dict } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = locale === "en" ? "hi" : "en";

  function choose() {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      className="btn btn-quiet lang-switch"
      onClick={choose}
      aria-label={dict.nav.switchLabel}
      lang={next}
      aria-busy={pending || undefined}
    >
      {dict.nav.switchTo}
    </button>
  );
}
