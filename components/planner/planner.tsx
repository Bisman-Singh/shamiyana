"use client";

import { useState, useSyncExternalStore, type ChangeEvent } from "react";
import { readTextFile } from "@/lib/client/files";
import {
  activePlan,
  canAddPlan,
  parseBackup,
  putPlan,
  removePlan,
  savePlan,
  selectPlan,
  sharedStore,
  type Notice,
  type PlanStore,
} from "@/lib/client/plan-store";
import { recordFromShare, type SharedPlan } from "@/lib/export/share";
import { format } from "@/lib/i18n/format";
import { LIMITS } from "@/lib/plan/constants";
import { draftFromBrief } from "@/lib/plan/draft";
import { createRecord, newId, updateBrief } from "@/lib/plan/record";
import type { Brief, PlanRecord } from "@/lib/plan/schema";
import { useLocale } from "../locale-provider";
import { useAnnounce } from "../ui/announcer";
import { BriefForm } from "./brief-form";
import {
  MessageNotice,
  PlannerSkeleton,
  PlansBar,
  SharedImport,
  StoreNotice,
  useIncomingShare,
  useToday,
  type Incoming,
  type Message,
} from "./planner-parts";
import { Workspace } from "./workspace";

const BACKUP_MAX_BYTES = 1_000_000;

type Mode = "plan" | "new" | "edit";

/**
 * Every store change reads the latest data at the moment it is made, never a
 * value captured by an earlier render, so a late AI answer and a user edit
 * can't overwrite each other.
 */
function useActions(
  store: PlanStore,
  go: (m: Mode) => void,
  setMessage: (m: Message) => void,
  stayPut: () => void,
) {
  const { dict } = useLocale();
  const latest = () => store.getSnapshot().data;
  const now = () => new Date().toISOString();
  return {
    save: (record: PlanRecord) => {
      store.commit(savePlan(latest(), record));
    },
    findPlan: (id: string) => latest().plans.find((p) => p.id === id) ?? null,
    create: (brief: Brief) => {
      store.commit(putPlan(latest(), createRecord(brief, newId(), now())));
      go("plan");
    },
    select: (id: string) => {
      store.commit(selectPlan(latest(), id));
      go("plan");
    },
    remove: (record: PlanRecord) => {
      store.commit(removePlan(latest(), record.id));
      stayPut();
      setMessage({
        tone: "success",
        text: format(dict.plans.deleted, { title: record.brief.title }),
        undo: record,
      });
    },
    restoreDeleted: (record: PlanRecord) => {
      store.commit(putPlan(latest(), record));
      go("plan");
    },
    addShared: (plan: SharedPlan) => {
      store.commit(putPlan(latest(), recordFromShare(plan, newId(), now())));
      go("plan");
    },
    restore: async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const result = parseBackup(await readTextFile(file, BACKUP_MAX_BYTES), latest());
      if (!result.ok) {
        const text =
          result.reason === "full"
            ? format(dict.plans.limit, { n: LIMITS.plansMax })
            : dict.downloads.badFile;
        setMessage({ tone: "error", text });
        return;
      }
      store.commit(putPlan(latest(), result.record));
      go("plan");
      setMessage({ tone: "success", text: dict.downloads.restored });
    },
  };
}

/** Storage problems, an incoming share link and the last action's message, in that order. */
function PlannerNotices({
  store,
  notice,
  incoming,
  full,
  message,
  onAdd,
  onDismissShare,
  onUndo,
}: {
  store: PlanStore;
  notice: Notice | null;
  incoming: Incoming;
  full: boolean;
  message: Message | null;
  onAdd: (plan: SharedPlan) => void;
  onDismissShare: () => void;
  onUndo: (record: PlanRecord) => void;
}) {
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
      {message ? <MessageNotice message={message} onUndo={onUndo} /> : null}
    </>
  );
}

/** The brief form, new or editing the open plan. */
function PlanForm({
  active,
  today,
  focusOnOpen,
  onCreate,
  onSave,
  onCancel,
}: {
  active: PlanRecord | null;
  today: string;
  focusOnOpen: boolean;
  onCreate: (brief: Brief) => void;
  onSave: (record: PlanRecord) => void;
  onCancel: (() => void) | null;
}) {
  return (
    <BriefForm
      key={active ? active.id : "new"}
      today={today}
      editing={active !== null}
      focusOnOpen={focusOnOpen}
      {...(active ? { initial: draftFromBrief(active.brief) } : {})}
      onSubmit={(brief) => {
        if (active) onSave(updateBrief(active, brief, new Date().toISOString()));
        else onCreate(brief);
      }}
      {...(onCancel ? { onCancel } : {})}
    />
  );
}

/**
 * Which view is open and the last action's message. Opening a view from an
 * action moves focus to its heading, as a page change would; the first page
 * load doesn't.
 */
function useView() {
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
      setView((v) => ({ ...v, focus: false }));
    },
    show: (next: Message) => {
      setMessage(next);
      announce(next.text);
    },
  };
}

export function Planner({ store }: { store?: PlanStore }) {
  const plans = store ?? sharedStore();
  const snapshot = useSyncExternalStore(
    plans.subscribe,
    plans.getSnapshot,
    plans.getServerSnapshot,
  );
  const today = useToday();
  const [incoming, setIncoming] = useIncomingShare();
  const { view, go, stayPut, message, show } = useView();
  const actions = useActions(plans, go, show, stayPut);
  const { mode } = view;

  if (!snapshot.ready) return <PlannerSkeleton />;
  const { data } = snapshot;
  const active = activePlan(data);
  const full = !canAddPlan(data);
  const editing = mode === "edit" && active !== null;

  return (
    <div className="planner">
      <PlannerNotices
        store={plans}
        notice={snapshot.notice}
        incoming={incoming}
        full={full}
        message={message}
        onAdd={(plan) => {
          actions.addShared(plan);
          setIncoming(null);
        }}
        onDismissShare={() => {
          setIncoming(null);
        }}
        onUndo={actions.restoreDeleted}
      />
      <PlansBar
        plans={data.plans}
        active={active}
        full={full}
        onSelect={actions.select}
        onNew={() => {
          go("new");
        }}
        onRestore={(e) => void actions.restore(e)}
        onDelete={
          active && mode === "plan"
            ? () => {
                actions.remove(active);
              }
            : null
        }
      />
      {mode === "plan" && active ? (
        <Workspace
          key={active.id}
          record={active}
          today={today}
          onSave={actions.save}
          findPlan={actions.findPlan}
          focusOnOpen={view.focus}
          onEdit={() => {
            go("edit");
          }}
        />
      ) : (
        <PlanForm
          active={editing ? active : null}
          today={today}
          focusOnOpen={view.focus}
          onCreate={actions.create}
          onSave={(record) => {
            actions.save(record);
            go("plan");
          }}
          onCancel={
            active
              ? () => {
                  go("plan");
                }
              : null
          }
        />
      )}
    </div>
  );
}
