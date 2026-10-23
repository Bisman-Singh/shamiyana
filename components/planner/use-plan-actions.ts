"use client";

import type { ChangeEvent } from "react";
import { readTextFile } from "@/lib/client/files";
import {
  parseBackup,
  putPlan,
  removePlan,
  savePlan,
  selectPlan,
  type PlanStore,
} from "@/lib/client/plan-store";
import { recordFromShare, type SharedPlan } from "@/lib/export/share";
import { format } from "@/lib/i18n/format";
import { LIMITS } from "@/lib/plan/constants";
import { createRecord, newId } from "@/lib/plan/record";
import type { Brief, PlanRecord } from "@/lib/plan/schema";
import { useLocale } from "@/components/locale-provider";
import type { Message } from "./planner-notices";
import type { Mode } from "./use-planner-view";

const BACKUP_MAX_BYTES = 1_000_000;

/** Everything the planner can do to the saved plans. */
export interface PlanActions {
  save: (record: PlanRecord) => void;
  findPlan: (id: string) => PlanRecord | null;
  create: (brief: Brief) => void;
  select: (id: string) => void;
  remove: (record: PlanRecord) => void;
  restoreDeleted: (record: PlanRecord) => void;
  addShared: (plan: SharedPlan) => void;
  restore: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

/**
 * Every store change reads the latest data at the moment it is made, never a
 * value captured by an earlier render, so a late AI answer and a user edit
 * can't overwrite each other.
 */
export function usePlanActions(
  store: PlanStore,
  go: (mode: Mode) => void,
  show: (message: Message) => void,
  stayPut: () => void,
): PlanActions {
  const { dict } = useLocale();
  const latest = () => store.getSnapshot().data;
  const now = () => new Date().toISOString();
  return {
    save: (record) => {
      store.commit(savePlan(latest(), record));
    },
    findPlan: (id) => latest().plans.find((plan) => plan.id === id) ?? null,
    create: (brief) => {
      store.commit(putPlan(latest(), createRecord(brief, newId(), now())));
      go("plan");
    },
    select: (id) => {
      store.commit(selectPlan(latest(), id));
      go("plan");
    },
    remove: (record) => {
      store.commit(removePlan(latest(), record.id));
      stayPut();
      show({
        tone: "success",
        text: format(dict.plans.deleted, { title: record.brief.title }),
        undo: record,
      });
    },
    restoreDeleted: (record) => {
      store.commit(putPlan(latest(), record));
      go("plan");
    },
    addShared: (plan) => {
      store.commit(putPlan(latest(), recordFromShare(plan, newId(), now())));
      go("plan");
    },
    restore: async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const result = parseBackup(await readTextFile(file, BACKUP_MAX_BYTES), latest());
      if (!result.ok) {
        const text =
          result.reason === "full"
            ? format(dict.plans.limit, { n: LIMITS.plansMax })
            : dict.downloads.badFile;
        show({ tone: "error", text });
        return;
      }
      store.commit(putPlan(latest(), result.record));
      go("plan");
      show({ tone: "success", text: dict.downloads.restored });
    },
  };
}
