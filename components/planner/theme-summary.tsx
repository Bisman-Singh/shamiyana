"use client";

import { useId } from "react";
import { langOf } from "@/lib/i18n/lang";
import type { Enrichment } from "@/lib/plan/enrichment";
import { useLocale } from "@/components/locale-provider";

interface ThemeSummaryProps {
  theme: Enrichment["theme"];
  heading: string;
  /** The section heading's level; the theme's name sits one level below it. */
  level: 2 | 3;
}

/** The AI's theme for the event, in the language it was written in; nothing until it has a name. */
export function ThemeSummary({ theme, heading, level }: Readonly<ThemeSummaryProps>) {
  const { locale } = useLocale();
  const id = useId();
  if (theme.name === "") return null;
  const Heading = level === 2 ? "h2" : "h3";
  const Name = level === 2 ? "h3" : "h4";
  return (
    <section aria-labelledby={id}>
      <Heading id={id}>{heading}</Heading>
      <Name className="theme-name" lang={langOf(theme.name, locale)}>
        {theme.name}
      </Name>
      <p lang={langOf(theme.summary, locale)}>{theme.summary}</p>
    </section>
  );
}
