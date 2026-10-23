"use client";

import { useEffect, useId } from "react";
import type { SharedPlan } from "@/lib/export/share";
import { format } from "@/lib/i18n/format";
import { LIMITS } from "@/lib/plan/constants";
import { useLocale } from "@/components/locale-provider";
import { useAnnounce } from "@/components/ui/announcer";
import { focusHeading } from "@/components/ui/focus";
import { Notice } from "@/components/ui/notice";
import type { Incoming } from "./use-incoming-share";

interface SharedImportProps {
  incoming: Incoming;
  full: boolean;
  onAdd: (plan: SharedPlan) => void;
  onDismiss: () => void;
}

/** Offers to open a plan that arrived in a share link. */
export function SharedImport({ incoming, full, onAdd, onDismiss }: Readonly<SharedImportProps>) {
  const { dict } = useLocale();
  const headingId = useId();
  const announce = useAnnounce();
  const offered = incoming?.kind === "plan";
  useEffect(() => {
    if (offered) announce(dict.imported.heading);
  }, [offered, announce, dict.imported.heading]);
  if (incoming === null) return null;
  if (incoming.kind === "bad") return <Notice tone="error">{dict.imported.bad}</Notice>;
  return (
    <section className="notice notice-info" aria-labelledby={headingId}>
      <h2 id={headingId}>{dict.imported.heading}</h2>
      <p>{format(dict.imported.body, { title: incoming.plan.brief.title })}</p>
      {full ? <p>{format(dict.plans.limit, { n: LIMITS.plansMax })}</p> : null}
      <div className="actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={full}
          onClick={() => {
            onAdd(incoming.plan);
          }}
        >
          {dict.imported.open}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            onDismiss();
            focusHeading();
          }}
        >
          {dict.imported.dismiss}
        </button>
      </div>
    </section>
  );
}
