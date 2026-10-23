"use client";

import type { ReactNode } from "react";
import { langOf } from "@/lib/i18n/lang";
import { useLocale } from "@/components/locale-provider";

interface IdeaCardProps {
  title: string;
  detail: string;
  /** Tags above the title, such as the area and the cost. */
  meta?: ReactNode;
  /** The card's one action, such as Save or Remove. */
  action?: ReactNode;
}

/** One idea, from the AI, a photo or the saved list; its text keeps the language it was written in. */
export function IdeaCard({ title, detail, meta, action }: Readonly<IdeaCardProps>) {
  const { locale } = useLocale();
  return (
    <li className="idea">
      {meta ? <p className="idea-meta">{meta}</p> : null}
      <p className="idea-title" lang={langOf(title, locale)}>
        {title}
      </p>
      {detail === "" ? null : <p lang={langOf(detail, locale)}>{detail}</p>}
      {action}
    </li>
  );
}
