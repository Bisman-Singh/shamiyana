"use client";

import { useEffect, useId, useState, type ChangeEvent } from "react";
import type { Notice as StoreNoticeKind } from "@/lib/client/plan-store";
import { decodeShare, readShareHash, type SharedPlan } from "@/lib/export/share";
import { format } from "@/lib/i18n/format";
import { LIMITS } from "@/lib/plan/constants";
import { localToday } from "@/lib/plan/dates";
import type { PlanRecord, Store } from "@/lib/plan/schema";
import { useLocale } from "../locale-provider";
import { Notice } from "../ui/notice";

/** Today's date on this device, rolling over at midnight while the page is open. */
export function useToday(): string {
  const [today, setToday] = useState(localToday);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setToday(localToday());
    }, 60_000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  return today;
}

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

export function StoreNotice({
  notice,
  onDismiss,
}: {
  notice: StoreNoticeKind;
  onDismiss: () => void;
}) {
  const { dict } = useLocale();
  return (
    <Notice
      tone={notice === "full" ? "error" : "info"}
      action={
        <button type="button" className="btn btn-small btn-quiet" onClick={onDismiss}>
          {dict.common.close}
        </button>
      }
    >
      {dict.storage[notice]}
    </Notice>
  );
}

export function SharedImport({
  incoming,
  full,
  onAdd,
  onDismiss,
}: {
  incoming: Incoming;
  full: boolean;
  onAdd: (plan: SharedPlan) => void;
  onDismiss: () => void;
}) {
  const { dict } = useLocale();
  const headingId = useId();
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
        <button type="button" className="btn" onClick={onDismiss}>
          {dict.imported.dismiss}
        </button>
      </div>
    </section>
  );
}

export interface Message {
  tone: "success" | "error";
  text: string;
  undo?: Store;
}

export function MessageNotice({
  message,
  onUndo,
}: {
  message: Message;
  onUndo: (store: Store) => void;
}) {
  const { dict } = useLocale();
  const { undo } = message;
  return (
    <Notice
      tone={message.tone}
      action={
        undo ? (
          <button
            type="button"
            className="btn btn-small"
            onClick={() => {
              onUndo(undo);
            }}
          >
            {dict.common.undo}
          </button>
        ) : undefined
      }
    >
      {message.text}
    </Notice>
  );
}

export function PlansBar({
  plans,
  active,
  full,
  onSelect,
  onNew,
  onRestore,
  onDelete,
}: {
  plans: readonly PlanRecord[];
  active: PlanRecord | null;
  full: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRestore: (event: ChangeEvent<HTMLInputElement>) => void;
  onDelete: (() => void) | null;
}) {
  const { dict } = useLocale();
  const selectId = useId();
  return (
    <nav className="plans-bar" aria-label={dict.plans.heading}>
      {plans.length > 0 ? (
        <div className="field field-inline">
          <label htmlFor={selectId}>{dict.plans.switchLabel}</label>
          <select
            id={selectId}
            value={active?.id ?? ""}
            onChange={(e) => {
              onSelect(e.target.value);
            }}
          >
            {active ? null : <option value="">{dict.plans.heading}</option>}
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brief.title}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <button type="button" className="btn" disabled={full} onClick={onNew}>
        {dict.plans.new}
      </button>
      <label className="btn btn-quiet file-button">
        {dict.downloads.restore}
        <input
          type="file"
          accept="application/json,.json"
          className="visually-hidden"
          onChange={onRestore}
        />
      </label>
      {onDelete ? (
        <button type="button" className="btn btn-quiet" onClick={onDelete}>
          {dict.plans.delete}
        </button>
      ) : null}
    </nav>
  );
}

export function PlannerSkeleton() {
  const { dict } = useLocale();
  return (
    <div className="skeleton" aria-busy="true">
      <p className="visually-hidden">{dict.common.loading}</p>
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
      <div className="skeleton-block" />
    </div>
  );
}
