"use client";

import type { ReactNode } from "react";
import type { Enrichment } from "@/lib/plan/enrichment";
import { newId, removeIdea, saveIdea } from "@/lib/plan/record";
import { useLocale } from "../locale-provider";
import { PhotoIdeas } from "./photo-ideas";
import { RefineChat } from "./refine-chat";
import type { PlanView, Update } from "./types";

function AiIdeas({
  ideas,
  saved,
  update,
}: {
  ideas: Enrichment;
  saved: ReadonlySet<string>;
  update: Update;
}) {
  const { dict } = useLocale();
  const i = dict.ideas;
  return (
    <>
      {ideas.theme.name === "" ? null : (
        <section aria-labelledby="idea-theme">
          <h3 id="idea-theme">{i.theme}</h3>
          <p className="theme-name">{ideas.theme.name}</p>
          <p>{ideas.theme.summary}</p>
        </section>
      )}
      {ideas.ideas.length === 0 ? null : (
        <section aria-labelledby="idea-list">
          <h3 id="idea-list">{i.list}</h3>
          <ul className="idea-list">
            {ideas.ideas.map((idea) => (
              <li key={idea.title} className="idea">
                <p className="idea-meta">
                  <span className="tag">{i.areas[idea.area]}</span>{" "}
                  <span className="hint">{i.cost[idea.cost]}</span>
                </p>
                <p className="idea-title">{idea.title}</p>
                <p>{idea.detail}</p>
                <button
                  type="button"
                  className="btn btn-small"
                  disabled={saved.has(idea.title)}
                  onClick={() => {
                    update((r, now) =>
                      saveIdea(
                        r,
                        { id: newId(), area: idea.area, title: idea.title, detail: idea.detail },
                        now,
                      ),
                    );
                  }}
                >
                  {saved.has(idea.title) ? dict.common.saved : i.save}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {ideas.menu.length === 0 ? null : (
        <section aria-labelledby="idea-menu">
          <h3 id="idea-menu">{i.menu}</h3>
          <dl className="menu">
            {ideas.menu.map((course) => (
              <div key={course.course}>
                <dt>{course.course}</dt>
                <dd>{course.dishes.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  );
}

function SavedIdeas({ view, update }: { view: PlanView; update: Update }) {
  const { dict } = useLocale();
  const i = dict.ideas;
  return (
    <section aria-labelledby="idea-saved">
      <h3 id="idea-saved">{i.saved}</h3>
      {view.record.ideas.length === 0 ? (
        <p className="hint">{i.savedEmpty}</p>
      ) : (
        <ul className="idea-list">
          {view.record.ideas.map((idea) => (
            <li key={idea.id} className="idea">
              <p className="idea-meta">
                <span className="tag">{i.areas[idea.area]}</span>
              </p>
              <p className="idea-title">{idea.title}</p>
              {idea.detail === "" ? null : <p>{idea.detail}</p>}
              <button
                type="button"
                className="btn btn-small btn-quiet"
                onClick={() => {
                  update((r, now) => removeIdea(r, idea.id, now));
                }}
              >
                {dict.common.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function IdeasPanel({
  view,
  ideas,
  status,
  update,
}: {
  view: PlanView;
  ideas: Enrichment | null;
  status: ReactNode;
  update: Update;
}) {
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
