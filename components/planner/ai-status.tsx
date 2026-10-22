"use client";

import { format } from "@/lib/i18n/format";
import { useLocale } from "../locale-provider";
import { Notice } from "../ui/notice";
import type { EnrichmentState } from "./use-enrichment";

/** What the AI is doing right now, with the one action that makes sense for it. */
export function AiStatus({
  state,
  city,
  hasIdeas,
  onRegenerate,
  onRetry,
  onStop,
}: Readonly<{
  state: EnrichmentState;
  city: string;
  hasIdeas: boolean;
  onRegenerate: () => void;
  onRetry: () => void;
  onStop: () => void;
}>) {
  const { dict } = useLocale();
  const a = dict.ai;

  if (state.phase === "streaming") {
    return (
      <div className="ai-status" role="status">
        <p>
          <span className="pulse" aria-hidden="true" /> {format(a.writing, { city })}
        </p>
        <button type="button" className="btn btn-small" onClick={onStop}>
          {a.stop}
        </button>
      </div>
    );
  }
  if (state.phase === "error") {
    const retryable = state.error !== "ai_unavailable" && state.error !== "daily_cap";
    return (
      <Notice
        tone={state.error === "partial" ? "info" : "error"}
        action={
          retryable ? (
            <button type="button" className="btn btn-small" onClick={onRetry}>
              {a.retry}
            </button>
          ) : undefined
        }
      >
        {a.errors[state.error]}
      </Notice>
    );
  }
  return (
    <div className="ai-status">
      <p className="hint">{a.disclosure}</p>
      <button type="button" className="btn btn-small" onClick={onRegenerate}>
        {hasIdeas ? a.regenerate : a.retry}
      </button>
    </div>
  );
}
