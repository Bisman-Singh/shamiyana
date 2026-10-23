"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { langOf } from "@/lib/i18n/lang";
import { downloadText } from "@/lib/client/files";
import { fileName } from "@/lib/export/links";
import type { Dictionary } from "@/lib/i18n/en";
import { formatDate, formatMoney, plural } from "@/lib/i18n/format";
import { planBudget, summariseBudget } from "@/lib/plan/budget";
import type { Locale } from "@/lib/plan/constants";
import type { Enrichment } from "@/lib/plan/enrichment";
import { tallyGuests } from "@/lib/plan/guests";
import { withEnrichment } from "@/lib/plan/record";
import type { PlanRecord } from "@/lib/plan/schema";
import { buildTimeline } from "@/lib/plan/timeline";
import { buildVendors } from "@/lib/plan/vendors";
import { useLocale } from "../locale-provider";
import { useAnnounce } from "../ui/announcer";
import { useFocusOnMount } from "../ui/focus";
import { Notice } from "../ui/notice";
import { UndoButton } from "../ui/undo-button";
import { focusOpenPanel, Tabs, type Tab } from "../ui/tabs";
import { AiStatus, useStatusAnnouncements } from "./ai-status";
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

interface PlanHeaderProps {
  titleId: string;
  view: PlanView;
  focusOnOpen: boolean;
  onEdit: () => void;
  onShare: () => void;
}

function PlanHeader({ titleId, view, focusOnOpen, onEdit, onShare }: Readonly<PlanHeaderProps>) {
  const { dict, locale } = useLocale();
  const titleRef = useFocusOnMount<HTMLHeadingElement>(focusOnOpen);
  const w = dict.workspace;
  const { brief } = view.record;
  const days = view.timeline.daysToGo;
  const when = countdown(locale, w, days);
  return (
    <header className="plan-head">
      <div>
        <h1 id={titleId} ref={titleRef} tabIndex={-1} lang={langOf(brief.title, locale)}>
          {brief.title}
        </h1>
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

interface UndoNoticeProps {
  message: string;
  onUndo: () => void;
}

/** Shown after a removal; its button takes focus, since the removed row took the focus with it. */
function UndoNotice({ message, onUndo }: Readonly<UndoNoticeProps>) {
  return (
    <Notice tone="success" action={<UndoButton onUndo={onUndo} />}>
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
  /** Move focus to the plan title on open; true after an action, false on first page load. */
  focusOnOpen?: boolean;
  onEdit: () => void;
}

/**
 * Edits with an optional Undo. The offer lasts only while the plan is
 * exactly as the edit left it, so undoing can never wipe a later change,
 * such as AI ideas that arrived in the meantime.
 */
function useUndoable(record: PlanRecord, onSave: (record: PlanRecord) => void) {
  const announce = useAnnounce();
  const [undo, setUndo] = useState<{
    previous: PlanRecord;
    after: PlanRecord;
    message: string;
  } | null>(null);
  const update: Update = (edit, undoMessage) => {
    const next = edit(record, new Date().toISOString());
    onSave(next);
    setUndo(undoMessage ? { previous: record, after: next, message: undoMessage } : null);
    if (undoMessage) announce(undoMessage);
  };
  return {
    update,
    undo: undo?.after === record ? undo : null,
    clearUndo: () => {
      setUndo(null);
    },
  };
}

function countdown(locale: Locale, w: Dictionary["workspace"], days: number): string {
  if (days > 0) return plural(locale, w.daysToGo, days);
  return days === 0 ? w.isToday : w.isPast;
}

/** Names the browser tab after the open plan, and gives the page its own title back on close. */
function usePageTitle(title: string) {
  useEffect(() => {
    const before = document.title;
    document.title = title;
    return () => {
      document.title = before;
    };
  }, [title]);
}

/** One tab per panel; the AI status sits inside Ideas while that tab is open. */
function planTabs({
  w,
  view,
  ideas,
  streaming,
  status,
  update,
}: Readonly<{
  w: Dictionary["workspace"];
  view: PlanView;
  ideas: Enrichment | null;
  streaming: boolean;
  status: ReactNode;
  update: Update;
}>): Tab<TabId>[] {
  return [
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
          streaming={streaming}
          status={status}
          update={update}
        />
      ),
    },
  ];
}

/** One open plan: its header, the AI status, Undo, the tabs and the share dialog. */
export function Workspace({
  record,
  today,
  onSave,
  findPlan,
  focusOnOpen = false,
  onEdit,
}: Readonly<Props>) {
  const { dict, locale } = useLocale();
  const w = dict.workspace;
  const announce = useAnnounce();
  const [tab, setTab] = useState<TabId>("overview");
  const [sharing, setSharing] = useState(false);
  const titleId = useId();
  const view = usePlanView(record, today);
  const { update, undo, clearUndo } = useUndoable(record, onSave);

  const categories = view.budget.rows.map((r) => r.category);
  const ai = useEnrichment(record, categories, locale, today, (target, enrichment) => {
    const plan = findPlan(target.planId);
    if (!plan) return;
    const madeFor = { facts: target.facts, locale: target.locale };
    onSave(withEnrichment(plan, enrichment, madeFor, new Date().toISOString()));
    announce(dict.ai.ready);
  });
  const ideas = ai.state.phase === "streaming" ? ai.state.partial : record.enrichment;
  useStatusAnnouncements(ai.state);
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

  const tabs = planTabs({
    w,
    view,
    ideas,
    streaming: ai.state.phase === "streaming",
    status: tab === "ideas" ? status : null,
    update,
  });
  usePageTitle(`${record.brief.title} · ${dict.brand.name}`);

  return (
    <article className="workspace" aria-labelledby={titleId}>
      <PlanHeader
        titleId={titleId}
        view={view}
        focusOnOpen={focusOnOpen}
        onEdit={onEdit}
        onShare={() => {
          setSharing(true);
        }}
      />
      {tab === "ideas" ? null : status}
      {undo ? (
        <UndoNotice
          key={undo.after.updatedAt + undo.message}
          message={undo.message}
          onUndo={() => {
            onSave(undo.previous);
            clearUndo();
            focusOpenPanel();
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
