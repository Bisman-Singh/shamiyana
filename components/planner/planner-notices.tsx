"use client";

import { useEffect, useId } from "react";
import type { StorageIssue } from "@/lib/client/plan-store";
import type { SharedPlan } from "@/lib/export/share";
import { format } from "@/lib/i18n/format";
import { LIMITS } from "@/lib/plan/constants";
import type { PlanRecord } from "@/lib/plan/schema";
import { useLocale } from "../locale-provider";
import { useAnnounce } from "../ui/announcer";
import { Notice } from "../ui/notice";
import { UndoButton } from "../ui/undo-button";
import type { Incoming } from "./use-incoming-share";

/** A dismissed notice takes the focus with it, so focus goes to the page's heading. */
function focusHeading(): void {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>("h1")?.focus();
  });
}

interface StoreNoticeProps {
  notice: StorageIssue;
  onDismiss: () => void;
}

/** Says when the browser blocks or fills storage, or when saved data had to be recovered. */
export function StoreNotice({ notice, onDismiss }: Readonly<StoreNoticeProps>) {
  const { dict } = useLocale();
  return (
    <Notice
      tone={notice === "full" ? "error" : "info"}
      action={
        <button
          type="button"
          className="btn btn-small btn-quiet"
          onClick={() => {
            onDismiss();
            focusHeading();
          }}
        >
          {dict.common.close}
        </button>
      }
    >
      {dict.storage[notice]}
    </Notice>
  );
}

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

export interface Message {
  tone: "success" | "error";
  text: string;
  /** A deleted plan that Undo puts back. */
  undo?: PlanRecord;
}

interface MessageNoticeProps {
  message: Message;
  onUndo: (record: PlanRecord) => void;
}

/** A one-off message, with Undo when it reports a deleted plan. */
export function MessageNotice({ message, onUndo }: Readonly<MessageNoticeProps>) {
  const deleted = message.undo;
  return (
    <Notice
      tone={message.tone}
      action={
        deleted ? (
          <UndoButton
            onUndo={() => {
              onUndo(deleted);
            }}
          />
        ) : undefined
      }
    >
      {message.text}
    </Notice>
  );
}
