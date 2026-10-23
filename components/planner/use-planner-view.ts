"use client";

import { useState } from "react";
import { useAnnounce } from "@/components/ui/announcer";
import type { Message } from "./planner-notices";

/** What the planner shows: the open plan, the form for a new one, or the form editing the open one. */
export type Mode = "plan" | "new" | "edit";

/**
 * Which view is open and the last action's message. Opening a view from an
 * action moves focus to its heading, as a page change would; the first page
 * load doesn't.
 */
export function usePlannerView() {
  const announce = useAnnounce();
  const [view, setView] = useState<{ mode: Mode; focus: boolean }>({ mode: "plan", focus: false });
  const [message, setMessage] = useState<Message | null>(null);
  return {
    view,
    message,
    go: (mode: Mode) => {
      setView({ mode, focus: true });
      setMessage(null);
    },
    stayPut: () => {
      setView((current) => ({ ...current, focus: false }));
    },
    show: (next: Message) => {
      setMessage(next);
      announce(next.text);
    },
  };
}
