"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

/**
 * One AI request at a time per component. Starting a new one, cancelling, or
 * leaving the plan aborts the one in flight, so a stale reply never lands and
 * a reply nobody will see stops costing quota.
 */
export function useRequestSignal(): { next: () => AbortSignal; cancel: () => void } {
  const controller = useRef<AbortController | null>(null);
  const cancel = useCallback(() => {
    controller.current?.abort();
  }, []);
  useEffect(() => cancel, [cancel]);
  return useMemo(
    () => ({
      cancel,
      next: () => {
        cancel();
        controller.current = new AbortController();
        return controller.current.signal;
      },
    }),
    [cancel],
  );
}
