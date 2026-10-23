"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import type { VisionResult } from "@/lib/api/vision-result";
import { requestVision, type ApiError } from "@/lib/client/api";
import { prepareImage, UnsupportedImageError } from "@/lib/client/image";
import { factsOf } from "@/lib/plan/schema";
import { useLocale } from "@/components/locale-provider";
import type { PlanView } from "@/components/planner/types";
import { useAnnounce } from "@/components/ui/announcer";
import { useRequestSignal } from "./use-request-signal";

export interface Photo {
  blob: Blob;
  url: string;
  /** The file's own name, which describes the photo until the AI has looked. */
  name: string;
}

/** Why the photo flow stopped: the file itself, or the AI request. Translated when shown. */
export type PhotoFailure = { kind: "file"; code: "type" | "read" } | { kind: "ai"; code: ApiError };

export type PhotoState =
  | { phase: "empty" }
  | { phase: "ready" | "working"; photo: Photo }
  | { phase: "done"; photo: Photo; result: VisionResult }
  | { phase: "error"; failure: PhotoFailure; photo?: Photo };

/**
 * The photo flow: choose a file, shrink it in the browser, then send it once
 * for ideas. Choosing a new photo cancels a request still in flight, and each
 * preview URL is released when its photo is replaced.
 */
export function usePhotoIdeas(view: PlanView) {
  const { dict, locale } = useLocale();
  const announce = useAnnounce();
  const [state, setState] = useState<PhotoState>({ phase: "empty" });
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
      const code = error instanceof UnsupportedImageError ? "type" : "read";
      setState({ phase: "error", failure: { kind: "file", code } });
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
    if (result.ok) announce(dict.photo.ready);
    setState(
      result.ok
        ? { phase: "done", photo: current, result: result.data }
        : { phase: "error", failure: { kind: "ai", code: result.error }, photo: current },
    );
  }

  return { state, photo, choose, analyse };
}
