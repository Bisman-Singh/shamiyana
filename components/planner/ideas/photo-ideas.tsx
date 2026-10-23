"use client";

import { useId } from "react";
import { ACCEPTED_IMAGES } from "@/lib/client/files";
import type { Dictionary } from "@/lib/i18n/en";
import { format } from "@/lib/i18n/format";
import { useLocale } from "@/components/locale-provider";
import { Notice } from "@/components/ui/notice";
import type { PanelProps } from "@/components/planner/types";
import { usePhotoIdeas, type PhotoFailure, type PhotoState } from "./use-photo-ideas";
import { VisionResultView } from "./vision-result-view";

/** The words for a failure, in the page's language at the moment it is shown. */
function failureText(failure: PhotoFailure, dict: Dictionary): string {
  return failure.kind === "file" ? dict.photo.errors[failure.code] : dict.ai.errors[failure.code];
}

interface PhotoPreviewProps {
  state: PhotoState;
}

/** The chosen photo, named by its file until the AI has looked, then described by what it saw. */
function PhotoPreview({ state }: Readonly<PhotoPreviewProps>) {
  const { dict } = useLocale();
  if (!("photo" in state) || !state.photo) return null;
  const alt =
    state.phase === "done"
      ? `${dict.photo.kinds[state.result.kind]}: ${state.result.mood}`
      : format(dict.photo.preview, { name: state.photo.name });
  return <img src={state.photo.url} alt={alt} className="photo-preview" width={320} height={240} />;
}

/** Ideas from a venue, decor or outfit photo; the photo is sent once and not kept. */
export function PhotoIdeas({ view, update }: Readonly<PanelProps>) {
  const { dict } = useLocale();
  const headingId = useId();
  const { state, photo, choose, analyse } = usePhotoIdeas(view);

  return (
    <section aria-labelledby={headingId} className="photo-ideas">
      <h3 id={headingId}>{dict.photo.heading}</h3>
      <p className="hint" id={`${headingId}-hint`}>
        {dict.photo.intro}
      </p>
      <div className="actions">
        <label className="btn file-button">
          {dict.photo.choose}
          <input
            type="file"
            aria-describedby={`${headingId}-hint`}
            accept={ACCEPTED_IMAGES.join(",")}
            className="visually-hidden"
            onChange={(event) => void choose(event)}
          />
        </label>
        {photo ? (
          <button
            type="button"
            className="btn btn-primary"
            aria-disabled={state.phase === "working" || undefined}
            onClick={() => {
              if (state.phase !== "working") void analyse(photo);
            }}
          >
            {state.phase === "working" ? dict.photo.working : dict.photo.analyse}
          </button>
        ) : null}
      </div>
      <PhotoPreview state={state} />
      {state.phase === "error" ? (
        <Notice tone="error">{failureText(state.failure, dict)}</Notice>
      ) : null}
      {state.phase === "done" ? (
        <VisionResultView result={state.result} record={view.record} update={update} />
      ) : null}
    </section>
  );
}
