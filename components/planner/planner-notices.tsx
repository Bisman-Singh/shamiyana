"use client";

import { downloadText } from "@/lib/client/download";
import type { PlanStore, StorageIssue } from "@/lib/client/plan-store";
import type { SharedPlan } from "@/lib/export/share";
import type { PlanRecord } from "@/lib/plan/schema";
import { useLocale } from "@/components/locale-provider";
import { useAnnounce } from "@/components/ui/announcer";
import { focusHeading } from "@/components/ui/focus";
import { Notice } from "@/components/ui/notice";
import { UndoButton } from "@/components/ui/undo-button";
import { SharedImport } from "./shared-import";
import type { Incoming } from "./use-incoming-share";

interface StoreNoticeProps {
  store: PlanStore;
  notice: StorageIssue;
}

/** For data set aside because it couldn't be read: save it as a file, or delete it for good. */
function UnreadableActions({ store, text }: Readonly<{ store: PlanStore; text: string }>) {
  const { dict } = useLocale();
  const announce = useAnnounce();
  return (
    <>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => {
          downloadText("shamiyana-unreadable.json", "application/json", text);
        }}
      >
        {dict.storage.unreadableDownload}
      </button>
      <button
        type="button"
        className="btn btn-small btn-quiet"
        onClick={() => {
          store.deleteUnreadable();
          announce(dict.storage.unreadableDeleted);
          focusHeading();
        }}
      >
        {dict.storage.unreadableDelete}
      </button>
    </>
  );
}

/** Says when the browser blocks or fills storage, or when saved data had to be set aside. */
function StoreNotice({ store, notice }: Readonly<StoreNoticeProps>) {
  const { dict } = useLocale();
  const unreadable = notice === "recovered" ? store.readUnreadable() : null;
  const close = (
    <button
      type="button"
      className="btn btn-small btn-quiet"
      onClick={() => {
        store.dismissNotice();
        focusHeading();
      }}
    >
      {dict.common.close}
    </button>
  );
  return (
    <Notice
      tone={notice === "full" ? "error" : "info"}
      action={
        unreadable === null ? (
          close
        ) : (
          <div className="actions">
            <UnreadableActions store={store} text={unreadable} />
            {close}
          </div>
        )
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
      {notice ? <StoreNotice store={store} notice={notice} /> : null}
      <SharedImport incoming={incoming} full={full} onAdd={onAdd} onDismiss={onDismissShare} />
      {message ? (
        <MessageNotice key={message.undo?.id ?? message.text} message={message} onUndo={onUndo} />
      ) : null}
    </>
  );
}
