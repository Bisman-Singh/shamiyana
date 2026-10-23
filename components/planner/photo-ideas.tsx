"use client";

import { useEffect, useId, useState, type ChangeEvent } from "react";
import type { VisionResult } from "@/lib/ai/vision-result";
import { format } from "@/lib/i18n/format";
import { langOf } from "@/lib/i18n/lang";
import type { PlanRecord } from "@/lib/plan/schema";
import { requestVision } from "@/lib/client/api";
import { ACCEPTED_IMAGES, prepareImage, UnsupportedImageError } from "@/lib/client/files";
import { factsOf } from "@/lib/plan/schema";
import { useLocale } from "../locale-provider";
import { useAnnounce } from "../ui/announcer";
import { Notice } from "../ui/notice";
import type { PanelProps, PlanView, Update } from "./types";
import { SaveIdeaButton } from "./save-idea-button";
import { useRequestSignal } from "./use-request-signal";

interface Photo {
  blob: Blob;
  url: string;
  /** The file's own name, which describes the photo until the AI has looked. */
  name: string;
}

type State =
  | { phase: "empty" }
  | { phase: "ready" | "working"; photo: Photo }
  | { phase: "done"; photo: Photo; result: VisionResult }
  | { phase: "error"; message: string; photo?: Photo };

interface VisionResultViewProps {
  result: VisionResult;
  record: PlanRecord;
  update: Update;
}

function VisionResultView({ result, record, update }: Readonly<VisionResultViewProps>) {
  const { dict, locale } = useLocale();
  const p = dict.photo;
  return (
    <div className="photo-result">
      <p>
        <span className="tag">{p.kinds[result.kind]}</span>{" "}
        <span lang={langOf(result.mood, locale)}>{result.mood}</span>
      </p>
      {result.palette.length > 0 ? (
        <>
          <h4>{p.palette}</h4>
          <ul className="palette">
            {result.palette.map((c) => (
              <li key={c.hex}>
                <svg width="28" height="28" aria-hidden="true" focusable="false">
                  <rect
                    width="28"
                    height="28"
                    rx="4"
                    fill={c.hex}
                    stroke="currentColor"
                    strokeOpacity="0.3"
                  />
                </svg>
                <span lang={langOf(c.name, locale)}>{c.name}</span> <code>{c.hex}</code>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <ul className="idea-list">
        {result.ideas.map((idea) => (
          <li key={idea.title} className="idea">
            <p className="idea-title" lang={langOf(idea.title, locale)}>
              {idea.title}
            </p>
            <p lang={langOf(idea.detail, locale)}>{idea.detail}</p>
            <SaveIdeaButton idea={idea} record={record} update={update} />
          </li>
        ))}
      </ul>
      {result.notes.length > 0 ? (
        <>
          <h4>{p.notes}</h4>
          <ul className="plain-list">
            {result.notes.map((n) => (
              <li key={n} lang={langOf(n, locale)}>
                {n}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

interface PhotoPreviewProps {
  state: State;
}

/** The chosen photo, named by its file until the AI has looked, then described by what it saw. */
function PhotoPreview({ state }: Readonly<PhotoPreviewProps>) {
  const { dict } = useLocale();
  const p = dict.photo;
  if (!("photo" in state) || !state.photo) return null;
  const alt =
    state.phase === "done"
      ? `${p.kinds[state.result.kind]}: ${state.result.mood}`
      : format(p.preview, { name: state.photo.name });
  return <img src={state.photo.url} alt={alt} className="photo-preview" width={320} height={240} />;
}

/**
 * The photo flow: choose a file, shrink it in the browser, then send it once
 * for ideas. Choosing a new photo cancels a request still in flight, and each
 * preview URL is released when its photo is replaced.
 */
function usePhotoIdeas(view: PlanView) {
  const { dict, locale } = useLocale();
  const p = dict.photo;
  const announce = useAnnounce();
  const [state, setState] = useState<State>({ phase: "empty" });
  const photo = "photo" in state ? state.photo : undefined;
  const requests = useRequestSignal();

  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.url);
    };
  }, [photo]);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    requests.cancel();
    try {
      const blob = await prepareImage(file);
      setState({
        phase: "ready",
        photo: { blob, url: URL.createObjectURL(blob), name: file.name },
      });
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof UnsupportedImageError ? p.errors.type : p.errors.read,
      });
    }
  }

  async function analyse(current: Photo) {
    setState({ phase: "working", photo: current });
    const form = new FormData();
    form.set("image", new File([current.blob], "photo.jpg", { type: "image/jpeg" }));
    form.set(
      "fields",
      JSON.stringify({ facts: factsOf(view.record.brief), locale, today: view.today }),
    );
    const signal = requests.next();
    const result = await requestVision(form, signal);
    if (signal.aborted) return;
    if (result.ok) announce(p.ready);
    setState(
      result.ok
        ? { phase: "done", photo: current, result: result.data }
        : { phase: "error", message: dict.ai.errors[result.error], photo: current },
    );
  }

  return { state, photo, choose, analyse };
}

/** Ideas from a venue, decor or outfit photo; the photo is sent once and not kept. */
export function PhotoIdeas({ view, update }: Readonly<PanelProps>) {
  const { dict } = useLocale();
  const p = dict.photo;
  const headingId = useId();
  const { state, photo, choose, analyse } = usePhotoIdeas(view);

  return (
    <section aria-labelledby={headingId} className="photo-ideas">
      <h3 id={headingId}>{p.heading}</h3>
      <p className="hint" id={`${headingId}-hint`}>
        {p.intro}
      </p>
      <div className="actions">
        <label className="btn file-button">
          {p.choose}
          <input
            type="file"
            aria-describedby={`${headingId}-hint`}
            accept={ACCEPTED_IMAGES.join(",")}
            className="visually-hidden"
            onChange={(e) => void choose(e)}
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
            {state.phase === "working" ? p.working : p.analyse}
          </button>
        ) : null}
      </div>
      <PhotoPreview state={state} />
      {state.phase === "error" ? <Notice tone="error">{state.message}</Notice> : null}
      {state.phase === "done" ? (
        <VisionResultView result={state.result} record={view.record} update={update} />
      ) : null}
    </section>
  );
}
