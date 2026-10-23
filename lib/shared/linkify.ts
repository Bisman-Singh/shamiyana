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
