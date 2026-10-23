import type { BudgetSummary } from "@/lib/plan/budget";
import type { GuestTally } from "@/lib/plan/guests";
import type { PlanRecord } from "@/lib/plan/schema";
import type { Timeline } from "@/lib/plan/timeline";
import type { VendorCard } from "@/lib/plan/vendors";

/** Applies an edit to the open plan; with an undo message, the edit can be reverted from the notice. */
export type Update = (
  edit: (record: PlanRecord, now: string) => PlanRecord,
  undoMessage?: string,
) => void;

/** Everything a panel shows, derived once per render from the stored record. */
export interface PlanView {
  record: PlanRecord;
  today: string;
  budget: BudgetSummary;
  timeline: Timeline;
  vendors: VendorCard[];
  guests: GuestTally;
}

/** What every panel that edits the plan gets: the derived view and the way to change it. */
export interface PanelProps {
  view: PlanView;
  update: Update;
}
