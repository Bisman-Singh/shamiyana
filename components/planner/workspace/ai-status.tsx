"use client";

import { useEffect, useRef } from "react";
import { format } from "@/lib/i18n/format";
import { useLocale } from "@/components/locale-provider";
import { Notice } from "@/components/ui/notice";
import type { EnrichmentState } from "./use-enrichment";

interface AiStatusProps {
  state: EnrichmentState;
  city: string;
  hasIdeas: boolean;
  onRegenerate: () => void;
  onRetry: () => void;
  onStop: () => void;
}

/**
 * What the AI is doing right now, with the one action that makes sense for it.
 * A new status can replace the button that had focus, such as Stop giving way
 * to "Try again", so when focus was in here and fell to the page, it goes to
 * the new status's button, or to the status itself.
 */
export function AiStatus(props: Readonly<AiStatusProps>) {
  const slotRef = useRef<HTMLDivElement>(null);
  const hadFocusRef = useRef(false);
  const { phase } = props.state;
  // DOM listeners rather than JSX handlers: the slot is a focus target, not a control.
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
}: Readonly<AiStatusProps>) {
  const { dict } = useLocale();

  if (state.phase === "streaming") {
    return (
      <div className="ai-status">
        <p>
          <span className="pulse" aria-hidden="true" /> {format(dict.ai.writing, { city })}
        </p>
        <button type="button" className="btn btn-small" onClick={onStop}>
          {dict.ai.stop}
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
              {dict.ai.retry}
            </button>
          ) : undefined
        }
      >
        {dict.ai.errors[state.error]}
      </Notice>
    );
  }
  return (
    <div className="ai-status">
      <p className="hint">{dict.ai.disclosure}</p>
      <button type="button" className="btn btn-small" onClick={onRegenerate}>
        {hasIdeas ? dict.ai.regenerate : dict.ai.retry}
      </button>
    </div>
  );
}
