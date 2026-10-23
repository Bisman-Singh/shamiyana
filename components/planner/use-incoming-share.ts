"use client";

import { useEffect, useState } from "react";
import { decodeShare, readShareHash, type SharedPlan } from "@/lib/export/share";

export type Incoming = { kind: "plan"; plan: SharedPlan } | { kind: "bad" } | null;

/** Reads a shared plan from the URL fragment once, then clears the fragment. */
export function useIncomingShare(): [Incoming, (value: Incoming) => void] {
  const [incoming, setIncoming] = useState<Incoming>(null);
  useEffect(() => {
    const encoded = readShareHash(window.location.hash);
    if (encoded === null) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    void decodeShare(encoded).then((plan) => {
      setIncoming(plan ? { kind: "plan", plan } : { kind: "bad" });
    });
  }, []);
  return [incoming, setIncoming];
}
