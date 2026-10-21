/**
 * Plain-text hygiene for anything typed by a user or written by the model:
 * C0 controls, DEL and the bidi override and isolate marks are removed, so a
 * string can't hide characters or reorder itself on screen, in a CSV or in a
 * calendar file.
 */

// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROLS = /[\u0000-\u0009\u000B-\u001F\u007F‪-‮⁦-⁩]/g;
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROLS_AND_NEWLINES = /[\u0000-\u001F\u007F‪-‮⁦-⁩]/g;

export function cleanText(value: string, keepNewlines = false): string {
  return value
    .normalize("NFC")
    .replace(keepNewlines ? CONTROLS : CONTROLS_AND_NEWLINES, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * A single line of plain text, at most `max` UTF-16 units, cut on a grapheme
 * boundary so a Devanagari conjunct or an emoji is never split.
 */
export function clip(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const flat = cleanText(value).replace(/\s+/g, " ");
  if (flat.length <= max) return flat;
  let out = "";
  for (const { segment } of graphemes.segment(flat)) {
    if (out.length + segment.length > max) break;
    out += segment;
  }
  return out.trimEnd();
}
