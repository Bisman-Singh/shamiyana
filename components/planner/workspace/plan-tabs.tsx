import type { ReactNode } from "react";
import type { Dictionary } from "@/lib/i18n/en";
import type { Enrichment } from "@/lib/plan/enrichment";
import type { Tab } from "@/components/ui/tabs";
import { BudgetPanel } from "@/components/planner/budget-panel";
import { GuestsPanel } from "@/components/planner/guests/guests-panel";
import { IdeasPanel } from "@/components/planner/ideas/ideas-panel";
import { OverviewPanel } from "@/components/planner/overview-panel";
import { TimelinePanel } from "@/components/planner/timeline-panel";
import type { PlanView, Update } from "@/components/planner/types";
import { VendorsPanel } from "@/components/planner/vendors-panel";

export type TabId = "overview" | "budget" | "timeline" | "vendors" | "guests" | "ideas";

export interface PlanTabsInput {
  /** The tab names, in the page's language. */
  labels: Dictionary["workspace"]["tabs"];
  view: PlanView;
  /** The stored ideas, or the ones still arriving while the answer streams. */
  ideas: Enrichment | null;
  streaming: boolean;
  /** The AI status line, shown inside Ideas while that tab is open. */
  status: ReactNode;
  update: Update;
}

/** One tab per panel; the AI status sits inside Ideas while that tab is open. */
export function planTabs({
  labels,
  view,
  ideas,
  streaming,
  status,
  update,
}: Readonly<PlanTabsInput>): Tab<TabId>[] {
  return [
    { id: "overview", label: labels.overview, panel: <OverviewPanel view={view} ideas={ideas} /> },
    {
      id: "budget",
      label: labels.budget,
      panel: <BudgetPanel view={view} ideas={ideas} update={update} />,
    },
    {
      id: "timeline",
      label: labels.timeline,
      panel: <TimelinePanel view={view} update={update} />,
    },
    { id: "vendors", label: labels.vendors, panel: <VendorsPanel view={view} update={update} /> },
    { id: "guests", label: labels.guests, panel: <GuestsPanel view={view} update={update} /> },
    {
      id: "ideas",
      label: labels.ideas,
      panel: (
        <IdeasPanel
          view={view}
          ideas={ideas}
          streaming={streaming}
          status={status}
          update={update}
        />
      ),
    },
  ];
}
