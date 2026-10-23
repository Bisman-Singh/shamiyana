"use client";

import { useId, useState } from "react";
import { withEnrichment } from "@/lib/plan/record";
import type { PlanRecord } from "@/lib/plan/schema";
import { useLocale } from "@/components/locale-provider";
import { useAnnounce } from "@/components/ui/announcer";
import { focusOpenPanel } from "@/components/ui/focus";
import { Notice } from "@/components/ui/notice";
import { Tabs } from "@/components/ui/tabs";
import { UndoButton } from "@/components/ui/undo-button";
import { usePageTitle } from "@/components/ui/use-page-title";
import { AiStatus } from "./ai-status";
import { PlanHeader } from "./plan-header";
import { planTabs, type TabId } from "./plan-tabs";
import { ShareDialog } from "./share-dialog";
import { useEnrichment } from "./use-enrichment";
import { usePlanView } from "./use-plan-view";
import { useStatusAnnouncements } from "./use-status-announcements";
import { useUndoable } from "./use-undoable";

interface UndoNoticeProps {
  message: string;
  onUndo: () => void;
}

/**
 * Shown after a removal; its button takes focus, since the removed row took
 * the focus with it. If the offer ends while Undo has focus, for example when
 * AI ideas land, focus moves to the open panel rather than the page.
 */
function UndoNotice({ message, onUndo }: Readonly<UndoNoticeProps>) {
  return (
    <Notice tone="success" action={<UndoButton onUndo={onUndo} onVanish={focusOpenPanel} />}>
      {message}
    </Notice>
  );
}

interface WorkspaceProps {
  record: PlanRecord;
  today: string;
  /** Saves a new version of a plan: the open one, or another for an AI answer that arrives late. */
  onSave: (record: PlanRecord) => void;
  findPlan: (id: string) => PlanRecord | null;
  /** Move focus to the plan title on open; true after an action, false on first page load. */
  focusOnOpen?: boolean;
  onEdit: () => void;
}

/** One open plan: its header, the AI status, Undo, the tabs and the share dialog. */
export function Workspace({
  record,
  today,
  onSave,
  findPlan,
  focusOnOpen = false,
  onEdit,
}: Readonly<WorkspaceProps>) {
  const { dict, locale } = useLocale();
  const announce = useAnnounce();
  const [tab, setTab] = useState<TabId>("overview");
  const [sharing, setSharing] = useState(false);
  const titleId = useId();
  const view = usePlanView(record, today);
  const { update, undo, clearUndo } = useUndoable(record, onSave);

  const categories = view.budget.rows.map((row) => row.category);
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
    labels: dict.workspace.tabs,
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
      <Tabs label={dict.workspace.tabsLabel} tabs={tabs} selected={tab} onSelect={setTab} />
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
