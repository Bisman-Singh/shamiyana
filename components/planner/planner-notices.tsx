"use client";

import type { PlanStore, StorageIssue } from "@/lib/client/plan-store";
import type { SharedPlan } from "@/lib/export/share";
import type { PlanRecord } from "@/lib/plan/schema";
import { useLocale } from "@/components/locale-provider";
import { focusHeading } from "@/components/ui/focus";
import { Notice } from "@/components/ui/notice";
import { UndoButton } from "@/components/ui/undo-button";
import { SharedImport } from "./shared-import";
import type { Incoming } from "./use-incoming-share";

interface StoreNoticeProps {
  notice: StorageIssue;
  onDismiss: () => void;
}

/** Says when the browser blocks or fills storage, or when saved data had to be recovered. */
function StoreNotice({ notice, onDismiss }: Readonly<StoreNoticeProps>) {
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
function MessageNotice({ message, onUndo }: Readonly<MessageNoticeProps>) {
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

interface PlannerNoticesProps {
  store: PlanStore;
  notice: StorageIssue | null;
  incoming: Incoming;
  full: boolean;
  message: Message | null;
  onAdd: (plan: SharedPlan) => void;
  onDismissShare: () => void;
  onUndo: (record: PlanRecord) => void;
}

/** Storage problems, an incoming share link and the last action's message, in that order. */
export function PlannerNotices({
  store,
  notice,
  incoming,
  full,
  message,
  onAdd,
  onDismissShare,
  onUndo,
}: Readonly<PlannerNoticesProps>) {
  return (
    <>
      {notice ? (
        <StoreNotice
          notice={notice}
          onDismiss={() => {
            store.dismissNotice();
          }}
        />
      ) : null}
      <SharedImport incoming={incoming} full={full} onAdd={onAdd} onDismiss={onDismissShare} />
      {message ? (
        <MessageNotice key={message.undo?.id ?? message.text} message={message} onUndo={onUndo} />
      ) : null}
    </>
  );
}
