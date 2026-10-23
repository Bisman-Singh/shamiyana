"use client";

import { draftFromBrief } from "@/lib/plan/draft";
import { updateBrief } from "@/lib/plan/record";
import type { Brief, PlanRecord } from "@/lib/plan/schema";
import { BriefForm } from "@/components/planner/brief/brief-form";
import type { PlanActions } from "./use-plan-actions";
import type { Mode } from "./use-planner-view";
import { Workspace } from "./workspace/workspace";

interface PlanFormProps {
  active: PlanRecord | null;
  today: string;
  focusOnOpen: boolean;
  onCreate: (brief: Brief) => void;
  onSave: (record: PlanRecord) => void;
  onCancel?: () => void;
}

/** The brief form, new or editing the open plan. */
function PlanForm({
  active,
  today,
  focusOnOpen,
  onCreate,
  onSave,
  onCancel,
}: Readonly<PlanFormProps>) {
  return (
    <BriefForm
      key={active ? active.id : "new"}
      today={today}
      editing={active !== null}
      focusOnOpen={focusOnOpen}
      initial={active ? draftFromBrief(active.brief) : undefined}
      onSubmit={(brief) => {
        if (active) onSave(updateBrief(active, brief, new Date().toISOString()));
        else onCreate(brief);
      }}
      onCancel={onCancel}
    />
  );
}

interface PlanOrFormProps {
  active: PlanRecord | null;
  mode: Mode;
  today: string;
  focus: boolean;
  actions: PlanActions;
  go: (mode: Mode) => void;
}

/** The open plan, or the form that makes a new one or edits the open one. */
export function PlanOrForm({ active, mode, today, focus, actions, go }: Readonly<PlanOrFormProps>) {
  if (mode === "plan" && active) {
    return (
      <Workspace
        key={active.id}
        record={active}
        today={today}
        onSave={actions.save}
        findPlan={actions.findPlan}
        focusOnOpen={focus}
        onEdit={() => {
          go("edit");
        }}
      />
    );
  }
  const editing = mode === "edit" && active !== null;
  return (
    <PlanForm
      active={editing ? active : null}
      today={today}
      focusOnOpen={focus}
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
          : undefined
      }
    />
  );
}
