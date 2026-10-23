"use client";

import { useSyncExternalStore } from "react";
import { sharedStore, type PlanStore } from "@/lib/client/plan-store";
import { activePlan, canAddPlan } from "@/lib/plan/plans";
import { PlanOrForm } from "./plan-or-form";
import { PlannerNotices } from "./planner-notices";
import { PlannerSkeleton } from "./planner-skeleton";
import { PlansBar } from "./plans-bar";
import { useIncomingShare } from "./use-incoming-share";
import { usePlanActions } from "./use-plan-actions";
import { usePlannerView } from "./use-planner-view";
import { useToday } from "./use-today";

interface PlannerProps {
  store?: PlanStore;
}

/** The whole planner: saved plans, notices, and the open plan or its form. */
export function Planner({ store }: Readonly<PlannerProps>) {
  const plans = store ?? sharedStore();
  const snapshot = useSyncExternalStore(
    plans.subscribe,
    plans.getSnapshot,
    plans.getServerSnapshot,
  );
  const today = useToday();
  const [incoming, setIncoming] = useIncomingShare();
  const { view, go, stayPut, message, show } = usePlannerView();
  const actions = usePlanActions(plans, go, show, stayPut);
  const { mode } = view;

  if (!snapshot.ready) return <PlannerSkeleton />;
  const { data } = snapshot;
  const active = activePlan(data);
  const full = !canAddPlan(data);

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
        onRestore={(event) => void actions.restore(event)}
        onDelete={
          active && mode === "plan"
            ? () => {
                actions.remove(active);
              }
            : undefined
        }
      />
      <PlanOrForm
        active={active}
        mode={mode}
        today={today}
        focus={view.focus}
        actions={actions}
        go={go}
      />
    </div>
  );
}
