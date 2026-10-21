import { render, type RenderResult } from "@testing-library/react";
import axe from "axe-core";
import type { ReactElement } from "react";
import { LocaleProvider } from "@/components/locale-provider";
import { AnnouncerProvider } from "@/components/ui/announcer";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/plan/constants";

export function renderIn(ui: ReactElement, locale: Locale = "en"): RenderResult {
  return render(
    <LocaleProvider locale={locale} dict={getDictionary(locale)}>
      <AnnouncerProvider>{ui}</AnnouncerProvider>
    </LocaleProvider>,
  );
}

/** Runs axe on a rendered tree. Colour contrast needs real layout, so the browser e2e checks it. */
export async function expectAccessible(container: Element): Promise<void> {
  const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  const found = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
  );
  expect(found).toEqual([]);
}
