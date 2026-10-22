"use client";

import { useEffect, useId, useState, type ChangeEvent } from "react";
import type { VisionResult } from "@/lib/ai/vision-result";
import { requestVision } from "@/lib/client/api";
import { ACCEPTED_IMAGES, prepareImage } from "@/lib/client/files";
import { newId, saveIdea } from "@/lib/plan/record";
import { factsOf } from "@/lib/plan/schema";
import { useLocale } from "../locale-provider";
import { useAnnounce } from "../ui/announcer";
import { Notice } from "../ui/notice";
import type { PlanView, Update } from "./types";
import { useRequestSignal } from "./use-request-signal";

interface Photo {
  blob: Blob;
  url: string;
}

type State =
  | { phase: "empty" }
  | { phase: "ready" | "working"; photo: Photo }
  | { phase: "done"; photo: Photo; result: VisionResult }
  | { phase: "error"; message: string; photo?: Photo };

function VisionResultView({
  result,
  saved,
  update,
}: {
  result: VisionResult;
  saved: ReadonlySet<string>;
  update: Update;
}) {
  const { dict } = useLocale();
  const p = dict.photo;
  return (
    <div className="photo-result">
      <p>
        <span className="tag">{p.kinds[result.kind]}</span> {result.mood}
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
                <span>{c.name}</span> <code>{c.hex}</code>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <ul className="idea-list">
        {result.ideas.map((idea) => (
          <li key={idea.title} className="idea">
            <p className="idea-title">{idea.title}</p>
            <p>{idea.detail}</p>
            <button
              type="button"
              className="btn btn-small"
              aria-disabled={saved.has(idea.title) || undefined}
              onClick={() => {
                if (saved.has(idea.title)) return;
                update((r, now) => saveIdea(r, { id: newId(), ...idea }, now));
              }}
            >
              {saved.has(idea.title) ? dict.common.saved : dict.ideas.save}{" "}
              <span className="visually-hidden">{idea.title}</span>
            </button>
          </li>
        ))}
      </ul>
      {result.notes.length > 0 ? (
        <>
          <h4>{p.notes}</h4>
          <ul className="plain-list">
            {result.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export function PhotoIdeas({ view, update }: { view: PlanView; update: Update }) {
  const { dict, locale } = useLocale();
  const p = dict.photo;
  const announce = useAnnounce();
  const headingId = useId();
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
      setState({ phase: "ready", photo: { blob, url: URL.createObjectURL(blob) } });
    } catch (error) {
      setState({
        phase: "error",
        message: error instanceof TypeError ? p.errors.type : p.errors.read,
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

  return (
    <section aria-labelledby={headingId} className="photo-ideas">
      <h3 id={headingId}>{p.heading}</h3>
      <p className="hint">{p.intro}</p>
      <div className="actions">
        <label className="btn file-button">
          {p.choose}
          <input
            type="file"
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
      {photo ? (
        <img src={photo.url} alt={p.preview} className="photo-preview" width={320} height={240} />
      ) : null}
      {state.phase === "error" ? <Notice tone="error">{state.message}</Notice> : null}
      {state.phase === "done" ? (
        <VisionResultView
          result={state.result}
          saved={new Set(view.record.ideas.map((i) => i.title))}
          update={update}
        />
      ) : null}
    </section>
  );
}
