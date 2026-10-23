"use client";

import { useEffect, useId, useState, type ChangeEvent } from "react";
import type { Notice as StoreNoticeKind } from "@/lib/client/plan-store";
import { decodeShare, readShareHash, type SharedPlan } from "@/lib/export/share";
import { format } from "@/lib/i18n/format";
import { LIMITS } from "@/lib/plan/constants";
import { localToday } from "@/lib/plan/dates";
import type { PlanRecord } from "@/lib/plan/schema";
import { useLocale } from "../locale-provider";
import { Notice } from "../ui/notice";
import { UndoButton } from "../ui/undo-button";

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

/** A dismissed notice takes the focus with it, so focus goes to the page's heading. */
function focusHeading(): void {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>("h1")?.focus();
  });
}

export function StoreNotice({
  notice,
  onDismiss,
}: Readonly<{
  notice: StoreNoticeKind;
  onDismiss: () => void;
}>) {
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

export function SharedImport({
  incoming,
  full,
  onAdd,
  onDismiss,
}: Readonly<{
  incoming: Incoming;
  full: boolean;
  onAdd: (plan: SharedPlan) => void;
  onDismiss: () => void;
}>) {
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

export function MessageNotice({
  message,
  onUndo,
}: Readonly<{
  message: Message;
  onUndo: (record: PlanRecord) => void;
}>) {
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

/** Choosing in the list changes nothing until Open is pressed, so the page never switches under the user. */
function PlanPicker({
  plans,
  initial,
  onSelect,
}: Readonly<{
  plans: readonly PlanRecord[];
  initial: PlanRecord;
  onSelect: (id: string) => void;
}>) {
  const { dict } = useLocale();
  const selectId = useId();
  const [choice, setChoice] = useState(initial.id);
  return (
    <div className="field field-inline">
      <label htmlFor={selectId}>{dict.plans.switchLabel}</label>
      <select
        id={selectId}
        value={choice}
        onChange={(e) => {
          setChoice(e.target.value);
        }}
      >
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.brief.title}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn"
        onClick={() => {
          onSelect(choice);
        }}
      >
        {dict.plans.open}
      </button>
    </div>
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
}: Readonly<{
  plans: readonly PlanRecord[];
  active: PlanRecord | null;
  full: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRestore: (event: ChangeEvent<HTMLInputElement>) => void;
  onDelete: (() => void) | null;
}>) {
  const { dict } = useLocale();
  const limitId = useId();
  return (
    <nav className="plans-bar" aria-label={dict.plans.heading}>
      {plans[0] ? (
        <PlanPicker
          key={active?.id ?? "none"}
          plans={plans}
          initial={active ?? plans[0]}
          onSelect={onSelect}
        />
      ) : null}
      <button
        type="button"
        className="btn"
        disabled={full}
        aria-describedby={full ? limitId : undefined}
        onClick={onNew}
      >
        {dict.plans.new}
      </button>
      {full ? (
        <p id={limitId} className="hint">
          {format(dict.plans.limit, { n: LIMITS.plansMax })}
        </p>
      ) : null}
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
