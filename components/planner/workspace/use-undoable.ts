"use client";

import { useState } from "react";
import type { PlanRecord } from "@/lib/plan/schema";
import type { Update } from "@/components/planner/types";
import { useAnnounce } from "@/components/ui/announcer";

/** An edit that can still be undone: the plan before it, the plan it made and what to say. */
export interface UndoOffer {
  previous: PlanRecord;
  after: PlanRecord;
  message: string;
}

/**
 * Edits with an optional Undo. The offer lasts only while the plan is
 * exactly as the edit left it, so undoing can never wipe a later change,
 * such as AI ideas that arrived in the meantime.
 */
export function useUndoable(record: PlanRecord, onSave: (record: PlanRecord) => void) {
  const announce = useAnnounce();
  const [offer, setOffer] = useState<UndoOffer | null>(null);
  const update: Update = (edit, undoMessage) => {
    const next = edit(record, new Date().toISOString());
    onSave(next);
    setOffer(undoMessage ? { previous: record, after: next, message: undoMessage } : null);
    if (undoMessage) announce(undoMessage);
  };
  return {
    update,
    undo: offer?.after === record ? offer : null,
    clearUndo: () => {
      setOffer(null);
    },
  };
}
