"use client";

import type { IdeaArea } from "@/lib/plan/constants";
import { isIdeaSaved, newId, saveIdea } from "@/lib/plan/record";
import type { PlanRecord } from "@/lib/plan/schema";
import { useLocale } from "../locale-provider";
import type { Update } from "./types";

interface SaveIdeaButtonProps {
  idea: { area: IdeaArea; title: string; detail: string };
  record: PlanRecord;
  update: Update;
}

/** Saves an idea to the plan once; after that it reads Saved and does nothing. */
export function SaveIdeaButton({ idea, record, update }: Readonly<SaveIdeaButtonProps>) {
  const { dict } = useLocale();
  const saved = isIdeaSaved(record, idea);
  return (
    <button
      type="button"
      className="btn btn-small"
      aria-disabled={saved || undefined}
      onClick={() => {
        if (saved) return;
        const { area, title, detail } = idea;
        update((r, now) => saveIdea(r, { id: newId(), area, title, detail }, now));
      }}
    >
      {saved ? dict.common.saved : dict.ideas.save}{" "}
      <span className="visually-hidden">{idea.title}</span>
    </button>
  );
}
