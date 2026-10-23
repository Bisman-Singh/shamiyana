import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { Workspace } from "@/components/planner/workspace";
import type { Locale } from "@/lib/plan/constants";
import type { PlanRecord } from "@/lib/plan/schema";
import { TODAY } from "../fixtures";
import { renderIn } from "./render";

/** Holds a plan in state the way the planner does, and exposes the latest saved version. */
export function renderWorkspace(initial: PlanRecord, onEdit = vi.fn(), locale: Locale = "en") {
  const saved: { current: PlanRecord } = { current: initial };
  function Harness() {
    const [record, setRecord] = useState(initial);
    const ref = useRef(record);
    ref.current = record;
    return (
      <Workspace
        record={record}
        today={TODAY}
        onSave={(next) => {
          saved.current = next;
          ref.current = next;
          setRecord(next);
        }}
        findPlan={(id) => (id === ref.current.id ? ref.current : null)}
        onEdit={onEdit}
      />
    );
  }
  const view = renderIn(<Harness />, locale);
  return { ...view, saved, onEdit };
}

export const panel = () => within(screen.getByRole("tabpanel"));

export async function openTab(name: string) {
  await userEvent.click(screen.getByRole("tab", { name }));
}
