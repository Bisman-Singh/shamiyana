"use client";

import { useEffect } from "react";
import { useLocale } from "@/components/locale-provider";
import { useAnnounce } from "@/components/ui/announcer";
import type { EnrichmentState } from "./use-enrichment";

/**
 * Says through the page's live region when an answer stops early; nothing
 * else on the page says it, while errors are alerts and finished ideas are
 * announced when they are saved. The start of writing is not announced, so it
 * never talks over the change that set it off. Called once per plan.
 */
export function useStatusAnnouncements(state: EnrichmentState): void {
  const { dict } = useLocale();
  const announce = useAnnounce();
  const stoppedEarly = state.phase === "error" && state.error === "partial";
  useEffect(() => {
    if (stoppedEarly) announce(dict.ai.errors.partial);
  }, [stoppedEarly, announce, dict.ai.errors.partial]);
}
