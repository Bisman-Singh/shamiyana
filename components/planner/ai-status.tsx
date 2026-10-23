"use client";

import { useEffect, useRef } from "react";
import { format } from "@/lib/i18n/format";
import { useLocale } from "../locale-provider";
import { Notice } from "../ui/notice";
import type { EnrichmentState } from "./use-enrichment";

/**
 * What the AI is doing right now, with the one action that makes sense for it.
 * A new status can replace the button that had focus, such as Stop giving way
 * to "Try again", so when focus was in here and fell to the page, it goes to
 * the new status's button, or to the status itself.
 */
export function AiStatus(props: Parameters<typeof StatusLine>[0]) {
  const slotRef = useRef<HTMLDivElement>(null);
  const hadFocusRef = useRef(false);
  const { phase } = props.state;
  useEffect(() => {
    const slot = slotRef.current;
    const enter = () => {
      hadFocusRef.current = true;
    };
    // A removed button takes focus with it and sends no target; a move inside is followed by focusin.
    const leave = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node) hadFocusRef.current = false;
    };
    slot?.addEventListener("focusin", enter);
    slot?.addEventListener("focusout", leave);
    return () => {
      slot?.removeEventListener("focusin", enter);
      slot?.removeEventListener("focusout", leave);
    };
  }, []);
  useEffect(() => {
    if (!hadFocusRef.current || document.activeElement !== document.body) return;
    (slotRef.current?.querySelector("button") ?? slotRef.current)?.focus();
  }, [phase]);
  return (
    <div ref={slotRef} tabIndex={-1}>
      <StatusLine {...props} />
    </div>
  );
}

/** One status, writing, failed or idle, with its one action. */
function StatusLine({
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
