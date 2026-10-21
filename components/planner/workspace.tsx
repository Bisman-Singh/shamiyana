"use client";

import { useMemo, useState } from "react";
import { downloadText } from "@/lib/client/files";
import { fileName } from "@/lib/export/links";
import { formatDate, formatMoney, plural } from "@/lib/i18n/format";
import { planBudget, summariseBudget } from "@/lib/plan/budget";
import { tallyGuests } from "@/lib/plan/guests";
import { withEnrichment } from "@/lib/plan/record";
import type { PlanRecord } from "@/lib/plan/schema";
import { buildTimeline } from "@/lib/plan/timeline";
import { buildVendors } from "@/lib/plan/vendors";
import { useLocale } from "../locale-provider";
import { Notice } from "../ui/notice";
import { Tabs, type Tab } from "../ui/tabs";
import { AiStatus } from "./ai-status";
import { BudgetPanel } from "./budget-panel";
import { GuestsPanel } from "./guests-panel";
import { IdeasPanel } from "./ideas-panel";
import { OverviewPanel } from "./overview-panel";
import { ShareDialog } from "./share-dialog";
import { TimelinePanel } from "./timeline-panel";
import type { PlanView, Update } from "./types";
import { useEnrichment } from "./use-enrichment";
import { VendorsPanel } from "./vendors-panel";

type TabId = "overview" | "budget" | "timeline" | "vendors" | "guests" | "ideas";

/** Every derived figure the panels show, recomputed only when the record or the day changes. */
export function usePlanView(record: PlanRecord, today: string): PlanView {
  return useMemo(() => {
    const lines = planBudget(record.brief, record.factors);
    return {
      record,
      today,
      budget: summariseBudget(lines, record.brief, record.vendors),
      timeline: buildTimeline(record, today),
      vendors: buildVendors(record, lines),
      guests: tallyGuests(record.guests),
    };
  }, [record, today]);
}

function PlanHeader({
  view,
  onEdit,
  onShare,
}: {
  view: PlanView;
  onEdit: () => void;
  onShare: () => void;
}) {
  const { dict, locale } = useLocale();
  const w = dict.workspace;
  const { brief } = view.record;
  const days = view.timeline.daysToGo;
  const when = days > 0 ? plural(locale, w.daysToGo, days) : days === 0 ? w.isToday : w.isPast;
  return (
    <header className="plan-head">
      <div>
        <h1 id="plan-title">{brief.title}</h1>
        <p className="plan-facts">
          <span>{formatDate(brief.date, locale, true)}</span>
          <span>{brief.city}</span>
          <span>{plural(locale, w.guests, brief.guests)}</span>
          <span>{formatMoney(brief.budget, locale)}</span>
        </p>
        <p className={days < 0 ? "countdown is-over" : "countdown"}>{when}</p>
      </div>
      <div className="plan-actions">
        <button type="button" className="btn" onClick={onEdit}>
          {w.edit}
        </button>
        <button type="button" className="btn" onClick={onShare}>
          {w.share}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            downloadText(
              fileName(brief.title, "json"),
              "application/json",
              JSON.stringify(view.record, null, 2),
            );
          }}
        >
          {dict.downloads.backup}
        </button>
        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => {
            window.print();
          }}
        >
          {w.print}
        </button>
      </div>
    </header>
  );
}

function UndoNotice({ message, onUndo }: { message: string; onUndo: () => void }) {
  const { dict } = useLocale();
  return (
    <Notice
      tone="success"
      action={
        <button type="button" className="btn btn-small" onClick={onUndo}>
          {dict.common.undo}
        </button>
      }
    >
      {message}
    </Notice>
  );
}

interface Props {
  record: PlanRecord;
  today: string;
  /** Saves a new version of a plan: the open one, or another for an AI answer that arrives late. */
  onSave: (record: PlanRecord) => void;
  findPlan: (id: string) => PlanRecord | null;
  onEdit: () => void;
}

export function Workspace({ record, today, onSave, findPlan, onEdit }: Props) {
  const { dict, locale } = useLocale();
  const w = dict.workspace;
  const [tab, setTab] = useState<TabId>("overview");
  const [sharing, setSharing] = useState(false);
  const [undo, setUndo] = useState<{ previous: PlanRecord; message: string } | null>(null);
  const view = usePlanView(record, today);

  const update: Update = (edit, undoMessage) => {
    const next = edit(record, new Date().toISOString());
    onSave(next);
    setUndo(undoMessage ? { previous: record, message: undoMessage } : null);
  };

  const categories = view.budget.rows.map((r) => r.category);
  const ai = useEnrichment(record, categories, locale, today, (target, enrichment) => {
    const plan = findPlan(target.planId);
    if (!plan) return;
    const madeFor = { brief: target.brief, locale: target.locale };
    onSave(withEnrichment(plan, enrichment, madeFor, new Date().toISOString()));
  });
  const ideas = ai.state.phase === "streaming" ? ai.state.partial : record.enrichment;
  const status = (
    <AiStatus
      state={ai.state}
      city={record.brief.city}
      hasIdeas={record.enrichment !== null}
      onRegenerate={ai.regenerate}
      onRetry={ai.retry}
      onStop={ai.stop}
    />
  );

  const tabs: Tab<TabId>[] = [
    { id: "overview", label: w.tabs.overview, panel: <OverviewPanel view={view} ideas={ideas} /> },
    {
      id: "budget",
      label: w.tabs.budget,
      panel: <BudgetPanel view={view} ideas={ideas} update={update} />,
    },
    {
      id: "timeline",
      label: w.tabs.timeline,
      panel: <TimelinePanel view={view} update={update} />,
    },
    { id: "vendors", label: w.tabs.vendors, panel: <VendorsPanel view={view} update={update} /> },
    { id: "guests", label: w.tabs.guests, panel: <GuestsPanel view={view} update={update} /> },
    {
      id: "ideas",
      label: w.tabs.ideas,
      panel: (
        <IdeasPanel
          view={view}
          ideas={ideas}
          status={tab === "ideas" ? status : null}
          update={update}
        />
      ),
    },
  ];

  return (
    <article className="workspace" aria-labelledby="plan-title">
      <PlanHeader
        view={view}
        onEdit={onEdit}
        onShare={() => {
          setSharing(true);
        }}
      />
      {tab === "ideas" ? null : status}
      {undo ? (
        <UndoNotice
          message={undo.message}
          onUndo={() => {
            onSave(undo.previous);
            setUndo(null);
          }}
        />
      ) : null}
      <Tabs label={w.tabsLabel} tabs={tabs} selected={tab} onSelect={setTab} />
      {sharing ? (
        <ShareDialog
          record={record}
          onClose={() => {
            setSharing(false);
          }}
        />
      ) : null}
    </article>
  );
}
