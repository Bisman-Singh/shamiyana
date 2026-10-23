"use client";

import type { VisionResult } from "@/lib/ai/vision-result";
import { langOf } from "@/lib/i18n/lang";
import type { PlanRecord } from "@/lib/plan/schema";
import { useLocale } from "@/components/locale-provider";
import { IdeaCard } from "@/components/planner/idea-card";
import type { Update } from "@/components/planner/types";
import { SaveIdeaButton } from "./save-idea-button";

interface VisionResultViewProps {
  result: VisionResult;
  record: PlanRecord;
  update: Update;
}

/** What the AI saw in the photo: its kind and mood, a palette, ideas to save and things to watch. */
export function VisionResultView({ result, record, update }: Readonly<VisionResultViewProps>) {
  const { dict, locale } = useLocale();
  return (
    <div className="photo-result">
      <p>
        <span className="tag">{dict.photo.kinds[result.kind]}</span>{" "}
        <span lang={langOf(result.mood, locale)}>{result.mood}</span>
      </p>
      {result.palette.length > 0 ? (
        <>
          <h4>{dict.photo.palette}</h4>
          <ul className="palette">
            {result.palette.map((colour) => (
              <li key={colour.hex}>
                <svg width="28" height="28" aria-hidden="true" focusable="false">
                  <rect
                    width="28"
                    height="28"
                    rx="4"
                    fill={colour.hex}
                    stroke="currentColor"
                    strokeOpacity="0.3"
                  />
                </svg>
                <span lang={langOf(colour.name, locale)}>{colour.name}</span>{" "}
                <code>{colour.hex}</code>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <ul className="idea-list">
        {result.ideas.map((idea) => (
          <IdeaCard
            key={idea.title}
            title={idea.title}
            detail={idea.detail}
            action={<SaveIdeaButton idea={idea} record={record} update={update} />}
          />
        ))}
      </ul>
      {result.notes.length > 0 ? (
        <>
          <h4>{dict.photo.notes}</h4>
          <ul className="plain-list">
            {result.notes.map((note) => (
              <li key={note} lang={langOf(note, locale)}>
                {note}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
