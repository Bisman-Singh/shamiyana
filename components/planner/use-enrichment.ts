"use client";

import { useObject } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { enrichmentOutputSchema } from "@/lib/ai/schemas";
import { errorFromMessage, type ApiError } from "@/lib/client/api";
import type { CategoryId, Locale } from "@/lib/plan/constants";
import { isEmptyEnrichment, sanitizeEnrichment, type Enrichment } from "@/lib/plan/enrichment";
import { factsOf, type EventFacts, type PlanRecord } from "@/lib/plan/schema";

export type EnrichmentState =
  | { phase: "idle" }
  | { phase: "streaming"; partial: Enrichment }
  | { phase: "error"; error: ApiError | "partial" };

interface Target {
  planId: string;
  facts: EventFacts;
  locale: Locale;
}

export type OnEnriched = (target: Target, enrichment: Enrichment) => void;

function keyOf(facts: EventFacts, locale: Locale): string {
  return JSON.stringify([facts, locale]);
}

/**
 * Streams the AI ideas for a plan. A plan remembers which event facts and
 * language its ideas were written for, so this asks again exactly when that
 * differs: a new plan, changed details, a language switch. Renaming the event
 * alone asks nothing, since the title is never sent. The result goes to
 * `onDone` with the request it answers, so switching plans mid-stream can't
 * file one plan's ideas under another. An answer that stops early keeps
 * whatever arrived.
 */
export function useEnrichment(
  record: PlanRecord,
  categories: readonly CategoryId[],
  locale: Locale,
  today: string,
  onDone: OnEnriched,
) {
  const [failure, setFailure] = useState<ApiError | "partial" | null>(null);
  const asked = useRef<string | null>(null);
  const facts = factsOf(record.brief);
  const target = useRef<Target>({ planId: record.id, facts, locale });
  const latest = useRef<unknown>(undefined);
  const done = useRef(onDone);
  const cats = useRef(categories);
  useEffect(() => {
    done.current = onDone;
    cats.current = categories;
  });

  const { object, submit, isLoading, stop } = useObject({
    api: "/api/plan",
    schema: enrichmentOutputSchema,
    onFinish: ({ object: complete, error }) => {
      const clean = sanitizeEnrichment(complete ?? latest.current, cats.current);
      if (!isEmptyEnrichment(clean)) done.current(target.current, clean);
      setFailure(error ? "partial" : null);
    },
    onError: (error) => {
      setFailure(errorFromMessage(error.message));
    },
  });
  useEffect(() => {
    latest.current = object;
  }, [object]);

  const key = keyOf(facts, locale);
  const madeFor = record.enrichedFor
    ? keyOf(record.enrichedFor.facts, record.enrichedFor.locale)
    : null;

  function request(fresh: boolean) {
    asked.current = `${record.id}|${key}`;
    target.current = { planId: record.id, facts, locale };
    setFailure(null);
    submit({ facts, locale, today, fresh });
  }

  const requestRef = useRef(request);
  useEffect(() => {
    requestRef.current = request;
  });

  useEffect(() => {
    if (madeFor === key || asked.current === `${record.id}|${key}`) return;
    requestRef.current(false);
  }, [record.id, key, madeFor]);

  const state: EnrichmentState = isLoading
    ? { phase: "streaming", partial: sanitizeEnrichment(object, categories) }
    : failure
      ? { phase: "error", error: failure }
      : { phase: "idle" };

  return {
    state,
    regenerate: () => {
      request(true);
    },
    retry: () => {
      request(false);
    },
    stop,
  };
}
