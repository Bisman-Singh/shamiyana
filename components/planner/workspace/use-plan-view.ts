"use client";

import { useMemo } from "react";
import { planBudget, previewShifts, summariseBudget } from "@/lib/plan/budget";
import { tallyGuests } from "@/lib/plan/guests";
import { factsOf, type PlanRecord } from "@/lib/plan/schema";
import { buildTimeline } from "@/lib/plan/timeline";
import { buildVendors } from "@/lib/plan/vendors";
import type { PlanView } from "@/components/planner/types";

/** Every derived figure the panels show, recomputed only when the record or the day changes. */
export function usePlanView(record: PlanRecord, today: string): PlanView {
  return useMemo(() => {
    const lines = planBudget(record.brief, record.factors);
    return {
      record,
      today,
      budget: summariseBudget(lines, record.brief, record.vendors),
      preview: previewShifts(factsOf(record.brief), record.factors),
      timeline: buildTimeline(record, today),
      vendors: buildVendors(record, lines),
      guests: tallyGuests(record.guests),
    };
  }, [record, today]);
}
