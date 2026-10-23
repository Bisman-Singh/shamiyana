import type { LegalPage } from "@/lib/i18n/legal";

/** Splits text into plain runs and bare https links, each keyed by where it starts. */
export function linkify(text: string): { at: number; text: string; link: boolean }[] {
  const out: { at: number; text: string; link: boolean }[] = [];
  let at = 0;
  for (const part of text.split(/(https:\/\/\S+)/)) {
    if (part !== "") out.push({ at, text: part, link: part.startsWith("https://") });
    at += part.length;
  }
  return out;
}

interface ParagraphProps {
  text: string;
}

/** Renders policy text; bare https links in it become real links. */
function Paragraph({ text }: Readonly<ParagraphProps>) {
  return (
    <p>
      {linkify(text).map((run) =>
        run.link ? (
          <a key={run.at} href={run.text} rel="noopener noreferrer">
            {run.text}
          </a>
        ) : (
          <span key={run.at}>{run.text}</span>
        ),
      )}
    </p>
  );
}

interface LegalArticleProps {
  page: LegalPage;
}

/** A policy page: its title, last change and sections. */
export function LegalArticle({ page }: Readonly<LegalArticleProps>) {
  return (
    <article className="legal">
      <h1>{page.title}</h1>
      <p className="hint">{page.updated}</p>
      {page.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.body.map((text) => (
            <Paragraph key={text} text={text} />
          ))}
        </section>
      ))}
    </article>
  );
}
