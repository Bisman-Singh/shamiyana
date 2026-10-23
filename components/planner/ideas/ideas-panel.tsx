"use client";

import { useId, type ReactNode } from "react";
import { format } from "@/lib/i18n/format";
import { langOf } from "@/lib/i18n/lang";
import type { Enrichment } from "@/lib/plan/enrichment";
import { removeIdea } from "@/lib/plan/record";
import type { PlanRecord } from "@/lib/plan/schema";
import { useLocale } from "@/components/locale-provider";
import { IdeaCard } from "@/components/planner/idea-card";
import { ThemeSummary } from "@/components/planner/theme-summary";
import type { PanelProps, PlanView, Update } from "@/components/planner/types";
import { PhotoIdeas } from "./photo-ideas";
import { RefineChat } from "./refine-chat";
import { SaveIdeaButton } from "./save-idea-button";

interface AiIdeasProps {
  ideas: Enrichment;
  record: PlanRecord;
  /** While ideas stream in, a half-written idea has no Save button to focus or press. */
  streaming: boolean;
  update: Update;
}

/** The AI's theme, ideas and menu; ideas get a Save button once the answer has finished. */
function AiIdeas({ ideas, record, streaming, update }: Readonly<AiIdeasProps>) {
  const { dict, locale } = useLocale();
  const id = useId();
  return (
    <>
      <ThemeSummary theme={ideas.theme} heading={dict.ideas.theme} level={3} />
      {ideas.ideas.length === 0 ? null : (
        <section aria-labelledby={`${id}-list`}>
          <h3 id={`${id}-list`}>{dict.ideas.list}</h3>
          <ul className="idea-list">
            {ideas.ideas.map((idea) => (
              <IdeaCard
                key={idea.title}
                title={idea.title}
                detail={idea.detail}
                meta={
                  <>
                    <span className="tag">{dict.ideas.areas[idea.area]}</span>{" "}
                    <span className="hint">{dict.ideas.cost[idea.cost]}</span>
                  </>
                }
                action={
                  streaming ? null : <SaveIdeaButton idea={idea} record={record} update={update} />
                }
              />
            ))}
          </ul>
        </section>
      )}
      {ideas.menu.length === 0 ? null : (
        <section aria-labelledby={`${id}-menu`}>
          <h3 id={`${id}-menu`}>{dict.ideas.menu}</h3>
          <dl className="menu">
            {ideas.menu.map((course) => (
              <div key={course.course}>
                <dt lang={langOf(course.course, locale)}>{course.course}</dt>
                <dd lang={langOf(course.dishes.join(" "), locale)}>{course.dishes.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  );
}

/** Ideas the user kept, from the AI, a photo or the chat, each with Remove. */
function SavedIdeas({ view, update }: Readonly<PanelProps>) {
  const { dict, locale } = useLocale();
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h3 id={id}>{dict.ideas.saved}</h3>
      {view.record.ideas.length === 0 ? (
        <p className="hint">{dict.ideas.savedEmpty}</p>
      ) : (
        <ul className="idea-list">
          {view.record.ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              title={idea.title}
              detail={idea.detail}
              meta={<span className="tag">{dict.ideas.areas[idea.area]}</span>}
              action={
                <button
                  type="button"
                  className="btn btn-small btn-quiet"
                  onClick={() => {
                    update(
                      (record, now) => removeIdea(record, idea.id, now),
                      format(dict.ideas.removed, { title: idea.title }),
                    );
                  }}
                >
                  {dict.common.remove}{" "}
                  <span className="visually-hidden" lang={langOf(idea.title, locale)}>
                    {idea.title}
                  </span>
                </button>
              }
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface IdeasPanelProps {
  view: PlanView;
  ideas: Enrichment | null;
  streaming: boolean;
  status: ReactNode;
  update: Update;
}

/** AI ideas and menu, saved ideas, the refine chat and photo ideas. */
export function IdeasPanel({ view, ideas, streaming, status, update }: Readonly<IdeasPanelProps>) {
  const { dict } = useLocale();
  return (
    <div className="ideas">
      <div className="panel-head">
        <h2>{dict.ideas.heading}</h2>
      </div>
      {status}
      {ideas ? (
        <AiIdeas ideas={ideas} record={view.record} streaming={streaming} update={update} />
      ) : null}
      <RefineChat view={view} update={update} />
      <PhotoIdeas view={view} update={update} />
      <SavedIdeas view={view} update={update} />
    </div>
  );
}
