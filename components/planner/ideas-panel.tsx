"use client";

import { useId, type ReactNode } from "react";
import { langOf } from "@/lib/i18n/lang";
import type { Enrichment } from "@/lib/plan/enrichment";
import { format } from "@/lib/i18n/format";
import { removeIdea } from "@/lib/plan/record";
import { useLocale } from "../locale-provider";
import { PhotoIdeas } from "./photo-ideas";
import { RefineChat } from "./refine-chat";
import type { PanelProps, PlanView, Update } from "./types";
import { SaveIdeaButton } from "./save-idea-button";

interface AiIdeasProps {
  ideas: Enrichment;
  saved: ReadonlySet<string>;
  update: Update;
}

function AiIdeas({ ideas, saved, update }: Readonly<AiIdeasProps>) {
  const { dict, locale } = useLocale();
  const id = useId();
  const i = dict.ideas;
  return (
    <>
      {ideas.theme.name === "" ? null : (
        <section aria-labelledby={`${id}-theme`}>
          <h3 id={`${id}-theme`}>{i.theme}</h3>
          <h4 className="theme-name" lang={langOf(ideas.theme.name, locale)}>
            {ideas.theme.name}
          </h4>
          <p lang={langOf(ideas.theme.summary, locale)}>{ideas.theme.summary}</p>
        </section>
      )}
      {ideas.ideas.length === 0 ? null : (
        <section aria-labelledby={`${id}-list`}>
          <h3 id={`${id}-list`}>{i.list}</h3>
          <ul className="idea-list">
            {ideas.ideas.map((idea) => (
              <li key={idea.title} className="idea">
                <p className="idea-meta">
                  <span className="tag">{i.areas[idea.area]}</span>{" "}
                  <span className="hint">{i.cost[idea.cost]}</span>
                </p>
                <p className="idea-title" lang={langOf(idea.title, locale)}>
                  {idea.title}
                </p>
                <p lang={langOf(idea.detail, locale)}>{idea.detail}</p>
                <SaveIdeaButton idea={idea} saved={saved.has(idea.title)} update={update} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {ideas.menu.length === 0 ? null : (
        <section aria-labelledby={`${id}-menu`}>
          <h3 id={`${id}-menu`}>{i.menu}</h3>
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

function SavedIdeas({ view, update }: Readonly<PanelProps>) {
  const { dict, locale } = useLocale();
  const id = useId();
  const i = dict.ideas;
  return (
    <section aria-labelledby={id}>
      <h3 id={id}>{i.saved}</h3>
      {view.record.ideas.length === 0 ? (
        <p className="hint">{i.savedEmpty}</p>
      ) : (
        <ul className="idea-list">
          {view.record.ideas.map((idea) => (
            <li key={idea.id} className="idea">
              <p className="idea-meta">
                <span className="tag">{i.areas[idea.area]}</span>
              </p>
              <p className="idea-title" lang={langOf(idea.title, locale)}>
                {idea.title}
              </p>
              {idea.detail === "" ? null : <p lang={langOf(idea.detail, locale)}>{idea.detail}</p>}
              <button
                type="button"
                className="btn btn-small btn-quiet"
                onClick={() => {
                  update(
                    (r, now) => removeIdea(r, idea.id, now),
                    format(i.removed, { title: idea.title }),
                  );
                }}
              >
                {dict.common.remove} <span className="visually-hidden">{idea.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

interface IdeasPanelProps {
  view: PlanView;
  ideas: Enrichment | null;
  status: ReactNode;
  update: Update;
}

/** AI ideas and menu, saved ideas, the refine chat and photo ideas. */
export function IdeasPanel({ view, ideas, status, update }: Readonly<IdeasPanelProps>) {
  const { dict } = useLocale();
  const saved = new Set(view.record.ideas.map((s) => s.title));
  return (
    <div className="ideas">
      <div className="panel-head">
        <h2>{dict.ideas.heading}</h2>
      </div>
      {status}
      {ideas ? <AiIdeas ideas={ideas} saved={saved} update={update} /> : null}
      <RefineChat view={view} update={update} />
      <PhotoIdeas view={view} update={update} />
      <SavedIdeas view={view} update={update} />
    </div>
  );
}
