"use client";

import { useRef, useState, type SubmitEvent } from "react";
import type { Turn } from "@/lib/api/contracts";
import { requestRefine, type ApiError } from "@/lib/client/api";
import { plural } from "@/lib/i18n/format";
import { applyChanges, fitChanges, type Change } from "@/lib/plan/changes";
import { LIMITS, type Locale } from "@/lib/plan/constants";
import { wholeWeeks } from "@/lib/plan/dates";
import { factsOf } from "@/lib/plan/schema";
import { newId } from "@/lib/shared/ids";
import { cleanText } from "@/lib/shared/plain-text";
import { useLocale } from "@/components/locale-provider";
import type { PlanView, Update } from "@/components/planner/types";
import { useAnnounce } from "@/components/ui/announcer";
import { useRequestSignal } from "./use-request-signal";

/** A turn on screen: the model's view of it plus a key for the list. */
export interface ShownTurn extends Turn {
  id: string;
}

/** The changes the assistant proposed, and which of them the user has ticked. */
export interface Proposal {
  items: { key: string; change: Change; picked: boolean }[];
}

/** What the refine route needs: the event facts, never its title or guest list, and the last few turns. */
function refineBody(view: PlanView, locale: Locale, turns: readonly ShownTurn[], message: string) {
  return {
    facts: factsOf(view.record.brief),
    factors: view.record.factors,
    locale,
    today: view.today,
    history: turns.slice(-LIMITS.chatHistoryMax).map(({ role, text }) => ({ role, text })),
    message,
  };
}

/** Turns kept on screen; the model sees only the last few. */
const TURNS_KEPT = 12;

/**
 * The chat's state: the conversation, the request in flight and the changes
 * the assistant proposed. Nothing is applied until the user ticks it.
 */
export function useRefineChat(view: PlanView, update: Update) {
  const { dict, locale } = useLocale();
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<ShownTurn[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [quiet, setQuiet] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const announce = useAnnounce();
  const requests = useRequestSignal();

  async function send(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = cleanText(message);
    if (text === "" || pending) return;
    setPending(true);
    setError(null);
    setQuiet(false);
    const signal = requests.next();
    const result = await requestRefine(
      refineBody(view, locale, turns, text),
      view.budget.rows.map((row) => row.category),
      view.today,
      signal,
    );
    if (signal.aborted) return;
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("");
    setTurns((earlier) =>
      [
        ...earlier,
        { id: newId(), role: "user" as const, text },
        { id: newId(), role: "assistant" as const, text: result.data.reply },
      ].slice(-TURNS_KEPT),
    );
    const weeks = wholeWeeks(view.today, view.record.brief.date);
    const items = fitChanges(result.data.changes, weeks).map((change) => ({
      key: newId(),
      change,
      picked: false,
    }));
    setProposal(items.length > 0 ? { items } : null);
    setQuiet(items.length === 0);
    announce(
      items.length > 0 ? result.data.reply : `${result.data.reply} ${dict.refine.noChanges}`,
    );
  }

  function apply(current: Proposal) {
    const chosen = current.items.filter((item) => item.picked).map((item) => item.change);
    const note = plural(locale, dict.refine.applied, chosen.length);
    update((record, now) => applyChanges(record, chosen, newId, now), note);
    setProposal(null);
  }

  return {
    message,
    setMessage,
    turns,
    pending,
    error,
    proposal,
    setProposal,
    quiet,
    inputRef,
    send,
    apply,
  };
}
